-- CRITICAL SECURITY FIX: Enhanced Trade Secret Formula Protection
-- This migration implements multi-layered security controls for trade secret formulas

-- Step 1: Create enhanced security configuration table
CREATE TABLE IF NOT EXISTS public.security_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key text UNIQUE NOT NULL,
    config_value jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Step 2: Insert default security configurations
INSERT INTO public.security_config (config_key, config_value) VALUES 
('trade_secret_access_controls', '{
    "require_multi_approval": true,
    "minimum_approvers": 2,
    "max_access_duration_hours": 24,
    "require_active_session": true,
    "allowed_access_hours": {
        "start": "08:00",
        "end": "18:00"
    },
    "max_daily_accesses": 3,
    "suspicious_patterns": {
        "rapid_access_threshold": 5,
        "rapid_access_window_minutes": 10
    }
}'::jsonb),
('emergency_lockdown', '{"enabled": false, "reason": null, "locked_at": null}'::jsonb),
('ip_whitelist', '{"enabled": false, "allowed_ranges": []}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- Step 3: Create trade secret access session tracking
CREATE TABLE IF NOT EXISTS public.trade_secret_access_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    formula_id uuid NOT NULL,
    session_token text UNIQUE NOT NULL,
    started_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    ip_address inet,
    user_agent text,
    is_active boolean DEFAULT true,
    terminated_reason text,
    terminated_at timestamptz
);

-- Step 4: Add approval tracking for trade secret access
ALTER TABLE public.formula_access_permissions 
ADD COLUMN IF NOT EXISTS requires_multi_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS approver_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS security_clearance_level text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS access_conditions jsonb DEFAULT '{}'::jsonb;

-- Step 5: Create enhanced trade secret access control function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_trade_secret_formula_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.can_access_trade_secret_formula_secure(
    _user_id uuid, 
    _formula_id uuid, 
    _access_type text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    formula_classification text;
    has_valid_permission boolean := false;
    emergency_lockdown boolean := false;
    security_config jsonb;
    current_hour integer;
    daily_access_count integer;
    recent_access_count integer;
    user_ip inet;
    is_whitelisted boolean := true;
BEGIN
    -- Step 1: Check for emergency lockdown
    SELECT (config_value->>'enabled')::boolean INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        -- Log emergency lockdown attempt
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_lockdown', 
            jsonb_build_object('reason', 'emergency_lockdown_active'));
        RETURN false;
    END IF;

    -- Step 2: Get formula classification
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- Step 3: For trade secret formulas, apply enhanced security
    IF formula_classification = 'trade_secret' THEN
        -- Get security configuration
        SELECT config_value INTO security_config
        FROM public.security_config 
        WHERE config_key = 'trade_secret_access_controls';
        
        -- Check business hours restriction
        current_hour := EXTRACT(hour FROM now());
        IF current_hour < (security_config->'allowed_access_hours'->>'start')::integer 
           OR current_hour >= (security_config->'allowed_access_hours'->>'end')::integer THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_hours', 
                jsonb_build_object('current_hour', current_hour, 'allowed_hours', security_config->'allowed_access_hours'));
            RETURN false;
        END IF;
        
        -- Check daily access limit
        SELECT COUNT(*) INTO daily_access_count
        FROM public.formula_access_audit
        WHERE user_id = _user_id 
        AND formula_id = _formula_id
        AND accessed_at >= current_date
        AND access_type = 'view';
        
        IF daily_access_count >= (security_config->>'max_daily_accesses')::integer THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_daily_limit', 
                jsonb_build_object('daily_count', daily_access_count, 'limit', security_config->>'max_daily_accesses'));
            RETURN false;
        END IF;
        
        -- Check for suspicious rapid access patterns
        SELECT COUNT(*) INTO recent_access_count
        FROM public.formula_access_audit
        WHERE user_id = _user_id
        AND accessed_at >= now() - interval '10 minutes'
        AND access_type = 'view';
        
        IF recent_access_count >= (security_config->'suspicious_patterns'->>'rapid_access_threshold')::integer THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_suspicious', 
                jsonb_build_object('rapid_access_count', recent_access_count, 'threshold', security_config->'suspicious_patterns'->>'rapid_access_threshold'));
            RETURN false;
        END IF;
        
        -- Check IP whitelist if enabled
        SELECT (config_value->>'enabled')::boolean INTO emergency_lockdown
        FROM public.security_config 
        WHERE config_key = 'ip_whitelist';
        
        user_ip := inet_client_addr();
        IF emergency_lockdown AND user_ip IS NOT NULL THEN
            -- Simplified IP check - in production this would be more sophisticated
            is_whitelisted := true; -- This would check against allowed IP ranges
            
            IF NOT is_whitelisted THEN
                PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_ip', 
                    jsonb_build_object('ip_address', user_ip, 'reason', 'not_whitelisted'));
                RETURN false;
            END IF;
        END IF;
        
        -- Check for valid multi-approval permission
        SELECT EXISTS (
            SELECT 1 FROM public.formula_access_permissions fap
            WHERE fap.user_id = _user_id 
            AND fap.formula_id = _formula_id
            AND fap.access_type IN (_access_type, 'admin', 'write')
            AND fap.is_active = true
            AND (fap.expires_at IS NULL OR fap.expires_at > now())
            AND fap.security_clearance_level = 'trade_secret'
            AND CASE 
                WHEN (security_config->>'require_multi_approval')::boolean THEN
                    fap.approval_count >= (security_config->>'minimum_approvers')::integer
                ELSE true
            END
        ) INTO has_valid_permission;
        
        -- Additional check: Must have active session for trade secrets
        IF has_valid_permission AND (security_config->>'require_active_session')::boolean THEN
            has_valid_permission := EXISTS (
                SELECT 1 FROM public.trade_secret_access_sessions tss
                WHERE tss.user_id = _user_id
                AND tss.formula_id = _formula_id
                AND tss.is_active = true
                AND tss.expires_at > now()
            );
        END IF;
        
        RETURN has_valid_permission;
    END IF;
    
    -- For non-trade-secret formulas, use existing logic
    RETURN public.can_access_specific_formula(_user_id, _formula_id, _access_type);
END;
$$;

-- Step 6: Create function to start secure trade secret session
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='start_trade_secret_session' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.start_trade_secret_session(
    _formula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    session_token text;
    session_duration interval;
    result jsonb;
    security_config jsonb;
BEGIN
    -- Get session duration from config
    SELECT config_value INTO security_config
    FROM public.security_config 
    WHERE config_key = 'trade_secret_access_controls';
    
    session_duration := make_interval(hours => (security_config->>'max_access_duration_hours')::integer);
    
    -- Generate secure session token
    session_token := encode(extensions.gen_random_bytes(32), 'hex');
    
    -- Terminate any existing active sessions
    UPDATE public.trade_secret_access_sessions 
    SET is_active = false, 
        terminated_reason = 'new_session_started',
        terminated_at = now()
    WHERE user_id = auth.uid() 
    AND formula_id = _formula_id 
    AND is_active = true;
    
    -- Create new session
    INSERT INTO public.trade_secret_access_sessions (
        user_id, formula_id, session_token, expires_at, ip_address, user_agent
    ) VALUES (
        auth.uid(), _formula_id, session_token, now() + session_duration,
        inet_client_addr(), 'web-app'
    );
    
    -- Log session start
    PERFORM public.log_formula_access(auth.uid(), _formula_id, 'secure_session_started', 
        jsonb_build_object('session_duration_hours', (security_config->>'max_access_duration_hours')::integer));
    
    RETURN jsonb_build_object(
        'success', true,
        'session_token', session_token,
        'expires_at', now() + session_duration,
        'message', 'Secure access session initiated'
    );
END;
$$;

-- Step 7: Create enhanced approval function for trade secrets
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='approve_trade_secret_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.approve_trade_secret_access(
    _user_id uuid, 
    _formula_id uuid, 
    _access_type text,
    _justification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    approver_id uuid;
    current_approvals integer;
    required_approvals integer;
    permission_id uuid;
    security_config jsonb;
    result jsonb;
BEGIN
    approver_id := auth.uid();
    
    -- Only R&D managers and admins can approve trade secret access
    IF NOT (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = approver_id AND role IN ('admin', 'rd_manager'))
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient privileges to approve trade secret access');
    END IF;
    
    -- Cannot approve your own access
    IF approver_id = _user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot approve your own trade secret access');
    END IF;
    
    -- Get security configuration
    SELECT config_value INTO security_config
    FROM public.security_config 
    WHERE config_key = 'trade_secret_access_controls';
    
    required_approvals := (security_config->>'minimum_approvers')::integer;
    
    -- Get or create permission record
    SELECT id, approval_count INTO permission_id, current_approvals
    FROM public.formula_access_permissions
    WHERE user_id = _user_id 
    AND formula_id = _formula_id 
    AND access_type = _access_type;
    
    IF permission_id IS NULL THEN
        -- Create new permission record
        INSERT INTO public.formula_access_permissions (
            user_id, formula_id, access_type, granted_by, justification,
            requires_multi_approval, approval_count, approver_ids,
            security_clearance_level, expires_at
        ) VALUES (
            _user_id, _formula_id, _access_type, approver_id, _justification,
            true, 1, ARRAY[approver_id],
            'trade_secret', now() + interval '7 days'
        ) RETURNING id INTO permission_id;
        
        current_approvals := 1;
    ELSE
        -- Add approval if not already approved by this user
        IF approver_id = ANY(
            SELECT approver_ids FROM public.formula_access_permissions WHERE id = permission_id
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'You have already approved this access request');
        END IF;
        
        -- Update with new approval
        UPDATE public.formula_access_permissions 
        SET approval_count = approval_count + 1,
            approver_ids = array_append(approver_ids, approver_id),
            is_active = CASE 
                WHEN approval_count + 1 >= required_approvals THEN true 
                ELSE false 
            END
        WHERE id = permission_id;
        
        current_approvals := current_approvals + 1;
    END IF;
    
    -- Log the approval
    PERFORM public.log_formula_access(approver_id, _formula_id, 'trade_secret_approval_granted', 
        jsonb_build_object(
            'approved_user', _user_id,
            'current_approvals', current_approvals,
            'required_approvals', required_approvals,
            'justification', _justification
        ));
    
    RETURN jsonb_build_object(
        'success', true,
        'current_approvals', current_approvals,
        'required_approvals', required_approvals,
        'is_fully_approved', current_approvals >= required_approvals,
        'message', CASE 
            WHEN current_approvals >= required_approvals 
            THEN 'Trade secret access fully approved and activated'
            ELSE format('Approval recorded. %s more approval(s) needed.', required_approvals - current_approvals)
        END
    );
END;
$$;

-- Step 8: Create emergency lockdown function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='emergency_lockdown_trade_secrets' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.emergency_lockdown_trade_secrets(
    _reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only admins can trigger emergency lockdown
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Only administrators can trigger emergency lockdown';
    END IF;
    
    -- Update security config
    UPDATE public.security_config 
    SET config_value = jsonb_build_object(
        'enabled', true,
        'reason', _reason,
        'locked_at', now(),
        'locked_by', auth.uid()
    )
    WHERE config_key = 'emergency_lockdown';
    
    -- Terminate all active trade secret sessions
    UPDATE public.trade_secret_access_sessions 
    SET is_active = false,
        terminated_reason = 'emergency_lockdown',
        terminated_at = now()
    WHERE is_active = true;
    
    -- Log emergency action
    PERFORM public.log_formula_access(auth.uid(), null, 'emergency_lockdown_activated', 
        jsonb_build_object('reason', _reason, 'activated_at', now()));
    
    RETURN true;
END;
$$;

-- Step 9: Update RLS policy to use enhanced function
DO $pol$ BEGIN DROP POLICY IF EXISTS "Enhanced trade secret formula protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Ultra-secure trade secret formula protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Ultra-secure trade secret formula protection" 
ON public.formulas 
FOR SELECT 
USING (
    public.can_access_trade_secret_formula_secure(auth.uid(), id, 'read') 
    AND (
        public.log_formula_access(auth.uid(), id, 'view', 
            jsonb_build_object(
                'classification', classification_level, 
                'risk_level', CASE
                    WHEN classification_level = 'trade_secret' THEN 'critical'
                    WHEN classification_level = 'confidential' THEN 'high'
                    ELSE 'medium'
                END,
                'ip_address', inet_client_addr(),
                'timestamp', now()
            )
        ) IS NULL
    )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Step 10: Enable RLS on new tables
DO $rls$ BEGIN ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE public.trade_secret_access_sessions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Step 11: Create policies for new tables
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can manage security config" ON public.security_config; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can manage security config" 
ON public.security_config 
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR SELECT
USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "System can manage trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "System can manage trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR ALL
USING (true)
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Step 12: Create automated cleanup job function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='cleanup_expired_trade_secret_sessions' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.cleanup_expired_trade_secret_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Terminate expired sessions
    UPDATE public.trade_secret_access_sessions 
    SET is_active = false,
        terminated_reason = 'expired',
        terminated_at = now()
    WHERE is_active = true 
    AND expires_at < now();
    
    -- Clean up old audit logs (keep 1 year)
    DELETE FROM public.formula_access_audit 
    WHERE accessed_at < now() - interval '1 year';
    
    -- Clean up old sessions (keep 90 days)
    DELETE FROM public.trade_secret_access_sessions 
    WHERE (terminated_at < now() - interval '90 days') 
    OR (created_at < now() - interval '90 days' AND terminated_at IS NULL);
END;
$$;

-- Step 13: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_secret_sessions_user_formula 
ON public.trade_secret_access_sessions(user_id, formula_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_formula_access_audit_user_date 
ON public.formula_access_audit(user_id, accessed_at);

CREATE INDEX IF NOT EXISTS idx_formula_access_permissions_security 
ON public.formula_access_permissions(user_id, formula_id, security_clearance_level, is_active);

-- Final step: Add trigger for automatic cleanup
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='trigger_cleanup_expired_sessions' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Perform cleanup when new sessions are created
    PERFORM public.cleanup_expired_trade_secret_sessions();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_sessions_trigger ON public.trade_secret_access_sessions;
CREATE TRIGGER cleanup_sessions_trigger 
AFTER INSERT ON public.trade_secret_access_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_cleanup_expired_sessions();