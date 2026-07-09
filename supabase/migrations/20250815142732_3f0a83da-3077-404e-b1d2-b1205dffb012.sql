-- CRITICAL SECURITY FIX: Enhanced Trade Secret Formula Protection (Incremental Fix)

-- Step 1: Create enhanced security configuration table (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_config') THEN
        CREATE TABLE public.security_config (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            config_key text UNIQUE NOT NULL,
            config_value jsonb NOT NULL,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

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
('emergency_lockdown', '{"enabled": false, "reason": null, "locked_at": null}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- Step 3: Create trade secret access session tracking (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trade_secret_access_sessions') THEN
        CREATE TABLE public.trade_secret_access_sessions (
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
        
        ALTER TABLE public.trade_secret_access_sessions ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 4: Add approval tracking columns (safe add if not exists)
ALTER TABLE public.formula_access_permissions 
ADD COLUMN IF NOT EXISTS requires_multi_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS approver_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS security_clearance_level text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS access_conditions jsonb DEFAULT '{}'::jsonb;

-- Step 5: Create the ultra-secure access control function
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
BEGIN
    -- Check for emergency lockdown first
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_lockdown', 
            jsonb_build_object('reason', 'emergency_lockdown_active'));
        RETURN false;
    END IF;

    -- Get formula classification
    SELECT COALESCE(classification_level, 'standard') INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- For trade secret formulas, apply enhanced security
    IF formula_classification = 'trade_secret' THEN
        -- Get security configuration
        SELECT COALESCE(config_value, '{}'::jsonb) INTO security_config
        FROM public.security_config 
        WHERE config_key = 'trade_secret_access_controls';
        
        -- Check business hours restriction (8 AM to 6 PM)
        current_hour := EXTRACT(hour FROM now());
        IF current_hour < COALESCE((security_config->'allowed_access_hours'->>'start')::integer, 8)
           OR current_hour >= COALESCE((security_config->'allowed_access_hours'->>'end')::integer, 18) THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_hours', 
                jsonb_build_object('current_hour', current_hour));
            RETURN false;
        END IF;
        
        -- Check daily access limit (max 3 per day)
        SELECT COUNT(*) INTO daily_access_count
        FROM public.formula_access_audit
        WHERE user_id = _user_id 
        AND formula_id = _formula_id
        AND accessed_at >= current_date
        AND access_type = 'view';
        
        IF daily_access_count >= COALESCE((security_config->>'max_daily_accesses')::integer, 3) THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_daily_limit', 
                jsonb_build_object('daily_count', daily_access_count));
            RETURN false;
        END IF;
        
        -- Check for suspicious rapid access patterns
        SELECT COUNT(*) INTO recent_access_count
        FROM public.formula_access_audit
        WHERE user_id = _user_id
        AND accessed_at >= now() - interval '10 minutes';
        
        IF recent_access_count >= COALESCE((security_config->'suspicious_patterns'->>'rapid_access_threshold')::integer, 5) THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_suspicious', 
                jsonb_build_object('rapid_access_count', recent_access_count));
            RETURN false;
        END IF;
        
        -- Check for valid multi-approval permission for trade secrets
        SELECT EXISTS (
            SELECT 1 FROM public.formula_access_permissions fap
            WHERE fap.user_id = _user_id 
            AND fap.formula_id = _formula_id
            AND fap.access_type IN (_access_type, 'admin', 'write')
            AND fap.is_active = true
            AND (fap.expires_at IS NULL OR fap.expires_at > now())
            AND COALESCE(fap.security_clearance_level, 'standard') = 'trade_secret'
            AND COALESCE(fap.approval_count, 0) >= COALESCE((security_config->>'minimum_approvers')::integer, 2)
        ) INTO has_valid_permission;
        
        -- Additional check: Must have active session for trade secrets
        IF has_valid_permission THEN
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

-- Step 6: Create enhanced approval function
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
    current_approvals integer := 0;
    required_approvals integer := 2;
    permission_id uuid;
BEGIN
    approver_id := auth.uid();
    
    -- Only R&D managers and admins can approve trade secret access
    IF NOT (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = approver_id AND role IN ('admin', 'rd_manager'))
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient privileges');
    END IF;
    
    -- Cannot approve your own access
    IF approver_id = _user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot approve your own access');
    END IF;
    
    -- Get or create permission record
    SELECT id, COALESCE(approval_count, 0) INTO permission_id, current_approvals
    FROM public.formula_access_permissions
    WHERE user_id = _user_id 
    AND formula_id = _formula_id 
    AND access_type = _access_type;
    
    IF permission_id IS NULL THEN
        -- Create new permission record
        INSERT INTO public.formula_access_permissions (
            user_id, formula_id, access_type, granted_by, justification,
            requires_multi_approval, approval_count, approver_ids,
            security_clearance_level, expires_at, is_active
        ) VALUES (
            _user_id, _formula_id, _access_type, approver_id, _justification,
            true, 1, ARRAY[approver_id],
            'trade_secret', now() + interval '7 days', false
        ) RETURNING id INTO permission_id;
        
        current_approvals := 1;
    ELSE
        -- Check if already approved by this user
        IF approver_id = ANY(
            SELECT COALESCE(approver_ids, '{}') FROM public.formula_access_permissions WHERE id = permission_id
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Already approved by you');
        END IF;
        
        -- Add approval
        UPDATE public.formula_access_permissions 
        SET approval_count = COALESCE(approval_count, 0) + 1,
            approver_ids = array_append(COALESCE(approver_ids, '{}'), approver_id),
            is_active = CASE 
                WHEN COALESCE(approval_count, 0) + 1 >= required_approvals THEN true 
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
            'required_approvals', required_approvals
        ));
    
    RETURN jsonb_build_object(
        'success', true,
        'current_approvals', current_approvals,
        'required_approvals', required_approvals,
        'is_fully_approved', current_approvals >= required_approvals,
        'message', CASE 
            WHEN current_approvals >= required_approvals 
            THEN 'Trade secret access fully approved'
            ELSE format('%s more approval(s) needed', required_approvals - current_approvals)
        END
    );
END;
$$;

-- Step 7: Create emergency lockdown function
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
    
    RETURN true;
END;
$$;

-- Step 8: Drop and recreate the formulas policy safely
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Enhanced trade secret formula protection" ON public.formulas;
    DROP POLICY IF EXISTS "Ultra-secure trade secret formula protection" ON public.formulas;
    
    -- Create the new ultra-secure policy
    CREATE POLICY "Ultra-secure trade secret formula protection" 
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
                    'timestamp', now()
                )
            ) IS NULL
        )
    );
END $$;

-- Step 9: Create policies for new tables (with safe handling)
DO $$
BEGIN
    -- Create security config policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'security_config' 
        AND policyname = 'Only admins can manage security config'
    ) THEN
        CREATE POLICY "Only admins can manage security config" 
        ON public.security_config 
        FOR ALL
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    END IF;
    
    -- Create trade secret sessions policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'trade_secret_access_sessions' 
        AND policyname = 'Users can view their own trade secret sessions'
    ) THEN
        CREATE POLICY "Users can view their own trade secret sessions" 
        ON public.trade_secret_access_sessions 
        FOR SELECT
        USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'trade_secret_access_sessions' 
        AND policyname = 'System can manage trade secret sessions'
    ) THEN
        CREATE POLICY "System can manage trade secret sessions" 
        ON public.trade_secret_access_sessions 
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Step 10: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_secret_sessions_user_formula 
ON public.trade_secret_access_sessions(user_id, formula_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_formula_access_audit_user_date 
ON public.formula_access_audit(user_id, accessed_at);

CREATE INDEX IF NOT EXISTS idx_formula_access_permissions_security 
ON public.formula_access_permissions(user_id, formula_id, security_clearance_level, is_active);