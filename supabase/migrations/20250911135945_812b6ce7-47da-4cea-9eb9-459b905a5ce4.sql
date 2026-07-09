-- CRITICAL SECURITY: Enhanced Formula Protection Against Industrial Espionage (Fixed)
-- This migration implements comprehensive trade secret protection measures

-- First, drop existing function to avoid type conflicts
DROP FUNCTION IF EXISTS public.get_accessible_formulas(uuid);

-- 1. Create enhanced audit logging for formula access
CREATE OR REPLACE FUNCTION public.log_formula_access_enhanced(
    _user_id uuid, 
    _formula_id uuid, 
    _access_type text, 
    _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_security_level text;
BEGIN
    -- Get formula security level if formula_id is provided
    IF _formula_id IS NOT NULL THEN
        SELECT security_level INTO formula_security_level
        FROM public.formulas
        WHERE id = _formula_id;
    END IF;
    
    -- Enhanced logging for trade secrets
    IF formula_security_level = 'trade_secret' THEN
        -- Create high-priority security alert for trade secret access
        INSERT INTO public.security_alerts (
            alert_type, severity, details
        ) VALUES (
            'trade_secret_access_attempt',
            'critical',
            jsonb_build_object(
                'user_id', _user_id,
                'formula_id', _formula_id,
                'access_type', _access_type,
                'timestamp', now(),
                'formula_security_level', formula_security_level,
                'session_info', _details
            )
        );
    END IF;
    
    -- Log to audit table with enhanced details
    INSERT INTO public.formula_access_audit (
        user_id, formula_id, access_type, details, risk_level
    ) VALUES (
        _user_id, 
        _formula_id, 
        _access_type, 
        jsonb_build_object(
            'security_level', COALESCE(formula_security_level, 'unknown'),
            'session_details', _details,
            'access_timestamp', now()
        ),
        CASE 
            WHEN formula_security_level = 'trade_secret' THEN 'critical'
            WHEN formula_security_level = 'confidential' THEN 'high'
            ELSE 'medium'
        END
    );
END;
$$;

-- 2. Create secure trade secret session management table
CREATE TABLE IF NOT EXISTS public.trade_secret_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    formula_id uuid NOT NULL,
    session_token text NOT NULL UNIQUE,
    started_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    ip_address inet,
    user_agent text,
    terminated_at timestamptz,
    terminated_reason text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on trade secret sessions
ALTER TABLE public.trade_secret_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for trade secret sessions
DROP POLICY IF EXISTS "Users can manage their own trade secret sessions" ON public.trade_secret_sessions;
CREATE POLICY "Users can manage their own trade secret sessions"
ON public.trade_secret_sessions
FOR ALL
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Enhanced trade secret validation with session control
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_enhanced(
    _user_id uuid, 
    _formula_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_business_hours boolean := false;
    user_has_admin_role boolean := false;
    active_session_count integer := 0;
    emergency_lockdown boolean := false;
    suspicious_attempts integer := 0;
BEGIN
    -- Enhanced security checks
    IF _user_id IS NULL OR _formula_id IS NULL THEN
        PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'access_denied_invalid_params');
        RETURN false;
    END IF;
    
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'access_denied_emergency_lockdown');
        RETURN false;
    END IF;
    
    -- Check for suspicious activity patterns (more than 5 failed attempts in last hour)
    SELECT COUNT(*) INTO suspicious_attempts
    FROM public.formula_access_audit
    WHERE user_id = _user_id 
    AND access_type LIKE '%denied%'
    AND accessed_at > now() - interval '1 hour';
    
    IF suspicious_attempts >= 5 THEN
        -- Create security alert for suspicious activity
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES (
            'suspicious_formula_access',
            'critical',
            jsonb_build_object(
                'user_id', _user_id,
                'formula_id', _formula_id,
                'failed_attempts', suspicious_attempts,
                'alert_reason', 'Multiple failed access attempts - possible industrial espionage'
            )
        );
        
        PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'access_denied_suspicious_activity');
        RETURN false;
    END IF;
    
    -- CRITICAL: Only admins can access trade secrets
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'access_denied_insufficient_role');
        RETURN false;
    END IF;
    
    -- Enforce strict business hours (8 AM to 5 PM, Monday-Friday)
    is_business_hours := (
        EXTRACT(hour FROM now()) BETWEEN 8 AND 16 AND
        EXTRACT(dow FROM now()) BETWEEN 1 AND 5
    );
    
    IF NOT is_business_hours THEN
        PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'access_denied_outside_business_hours');
        RETURN false;
    END IF;
    
    -- Limit concurrent sessions per user (max 1 active trade secret session)
    SELECT COUNT(*) INTO active_session_count
    FROM public.trade_secret_sessions
    WHERE user_id = _user_id 
    AND is_active = true 
    AND expires_at > now();
    
    IF active_session_count >= 1 THEN
        PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'access_denied_concurrent_session_limit');
        RETURN false;
    END IF;
    
    -- All checks passed - log successful validation
    PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'trade_secret_access_validated');
    RETURN true;
END;
$$;

-- 4. Recreate the get_accessible_formulas function with enhanced security  
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
RETURNS TABLE(
    id uuid,
    code text,
    name text,
    product_code_line text,
    default_batch_size_kg numeric,
    average_piece_weight numeric,
    total_pieces integer,
    procedure_text text,
    active_ingredients_json jsonb,
    recipe_json jsonb,
    version text,
    yield_uom text,
    notes text,
    status text,
    security_level text,
    classification_level text,
    is_deleted boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Comprehensive access logging
    PERFORM public.log_formula_access_enhanced(_user_id, NULL, 'formula_list_requested', 
        jsonb_build_object('timestamp', now(), 'function', 'get_accessible_formulas'));
    
    -- Return formulas based on security level and user permissions
    RETURN QUERY
    SELECT 
        f.id,
        f.code,
        f.name,
        f.product_code_line,
        f.default_batch_size_kg,
        f.average_piece_weight,
        f.total_pieces,
        -- Redact sensitive procedure text for trade secrets without proper access
        CASE 
            WHEN f.security_level = 'trade_secret' THEN
                CASE 
                    WHEN public.validate_trade_secret_access_enhanced(_user_id, f.id) THEN f.procedure_text
                    ELSE '[TRADE SECRET - ACCESS RESTRICTED - CONTACT ADMIN]'
                END
            ELSE f.procedure_text
        END as procedure_text,
        -- Redact active ingredients for trade secrets
        CASE 
            WHEN f.security_level = 'trade_secret' THEN
                CASE 
                    WHEN public.validate_trade_secret_access_enhanced(_user_id, f.id) THEN f.active_ingredients_json
                    ELSE '[]'::jsonb
                END
            ELSE f.active_ingredients_json
        END as active_ingredients_json,
        -- Redact recipe for trade secrets
        CASE 
            WHEN f.security_level = 'trade_secret' THEN
                CASE 
                    WHEN public.validate_trade_secret_access_enhanced(_user_id, f.id) THEN f.recipe_json
                    ELSE '[]'::jsonb
                END
            ELSE f.recipe_json
        END as recipe_json,
        f.version,
        f.yield_uom,
        f.notes,
        f.status,
        f.security_level,
        f.classification_level,
        f.is_deleted,
        f.created_at,
        f.updated_at
    FROM public.formulas f
    WHERE NOT f.is_deleted
    AND (
        -- Standard formulas: accessible to production roles
        (f.security_level = 'standard' AND (
            has_role(_user_id, 'admin'::app_role) OR 
            has_role(_user_id, 'rd_manager'::app_role) OR 
            has_role(_user_id, 'production_manager'::app_role)
        ))
        OR
        -- Confidential formulas: accessible to admin and R&D
        (f.security_level = 'confidential' AND (
            has_role(_user_id, 'admin'::app_role) OR 
            has_role(_user_id, 'rd_manager'::app_role)
        ))
        OR
        -- Trade secrets: limited visibility, show placeholder data for unauthorized users
        (f.security_level = 'trade_secret' AND has_role(_user_id, 'admin'::app_role))
    )
    ORDER BY 
        -- Prioritize by security level (most secure first)
        CASE f.security_level 
            WHEN 'trade_secret' THEN 1
            WHEN 'confidential' THEN 2
            WHEN 'standard' THEN 3
            ELSE 4
        END,
        f.created_at DESC;
END;
$$;

-- 5. Enhanced RLS policy for formulas with additional security layers
DROP POLICY IF EXISTS "Maximum security formula access control" ON public.formulas;
CREATE POLICY "Maximum security formula access control"
ON public.formulas
FOR SELECT
USING (
    NOT is_deleted AND (
        -- Standard formulas with role-based access
        (security_level = 'standard' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role) OR 
            has_role(auth.uid(), 'production_manager'::app_role)
        ))
        OR
        -- Confidential formulas with elevated access
        (security_level = 'confidential' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role)
        ))
        OR
        -- Trade secrets with maximum security validation
        (security_level = 'trade_secret' AND 
         validate_trade_secret_access_enhanced(auth.uid(), id))
    )
);

-- 6. Create emergency termination function
CREATE OR REPLACE FUNCTION public.emergency_terminate_trade_secret_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can call this function
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can terminate trade secret sessions';
    END IF;
    
    -- Terminate all active sessions
    UPDATE public.trade_secret_sessions 
    SET is_active = false,
        terminated_at = now(),
        terminated_reason = 'emergency_termination'
    WHERE is_active = true;
    
    -- Log the emergency action
    INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES (
        'emergency_session_termination',
        'critical',
        jsonb_build_object(
            'terminated_by', auth.uid(),
            'timestamp', now(),
            'reason', 'Emergency termination of all trade secret sessions'
        )
    );
END;
$$;

-- 7. Automatic session cleanup
CREATE OR REPLACE FUNCTION public.cleanup_expired_trade_secret_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Terminate expired sessions
    UPDATE public.trade_secret_sessions 
    SET is_active = false,
        terminated_at = now(),
        terminated_reason = 'session_timeout'
    WHERE is_active = true 
    AND expires_at < now();
    
    -- Clean up old session records (keep for 90 days for audit)
    DELETE FROM public.trade_secret_sessions 
    WHERE created_at < now() - interval '90 days';
END;
$$;

-- 8. Security documentation
COMMENT ON FUNCTION public.get_accessible_formulas(uuid) IS 'SECURITY-CRITICAL: Enhanced formula access function with comprehensive trade secret protection. All access is logged and monitored for suspicious activity.';
COMMENT ON FUNCTION public.validate_trade_secret_access_enhanced(uuid, uuid) IS 'SECURITY-CRITICAL: Multi-layered validation for trade secret access including business hours, session limits, and suspicious activity detection.';
COMMENT ON TABLE public.trade_secret_sessions IS 'SECURITY-CRITICAL: Session management for trade secret access with automatic expiration and audit trail.';

-- Final security alert about the enhanced protection
INSERT INTO public.security_alerts (alert_type, severity, details)
VALUES (
    'security_enhancement_deployed',
    'info',
    jsonb_build_object(
        'deployment_time', now(),
        'enhancement', 'Enhanced trade secret protection against industrial espionage',
        'features', jsonb_build_array(
            'Multi-layered access validation',
            'Session management and limits', 
            'Suspicious activity detection',
            'Business hours enforcement',
            'Comprehensive audit logging',
            'Emergency session termination',
            'Data redaction for unauthorized access'
        )
    )
);