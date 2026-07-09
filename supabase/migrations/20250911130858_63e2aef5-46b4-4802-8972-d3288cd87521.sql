-- CRITICAL SECURITY FIX: Strengthen trade secret protection (Phase 1)
-- Fix industrial espionage vulnerabilities step by step

-- 1. Enable security monitoring
UPDATE public.security_config 
SET config_value = jsonb_set(config_value, '{enabled}', 'true')
WHERE config_key = 'formula_security_monitoring';

-- 2. Enable IP restrictions for trade secrets
UPDATE public.security_config 
SET config_value = jsonb_set(
    jsonb_set(config_value, '{enabled}', 'true'),
    '{allowed_networks}', '["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]'::jsonb
)
WHERE config_key = 'trade_secret_ip_restrictions';

-- 3. Create enhanced trade secret validation function (replaces complex existing one)
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_strict(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_business_hours boolean := false;
    user_has_admin_role boolean := false;
    emergency_lockdown boolean := false;
BEGIN
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        -- Log lockdown access attempt
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_emergency_blocked', 'critical', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id));
        RETURN false;
    END IF;
    
    -- STRICT: Only admins can access trade secrets (period)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        -- Log unauthorized access attempt
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_unauthorized', 'critical', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id));
        RETURN false;
    END IF;
    
    -- Enforce business hours (8 AM to 6 PM weekdays only)
    is_business_hours := (
        EXTRACT(hour FROM now()) BETWEEN 8 AND 17 AND
        EXTRACT(dow FROM now()) BETWEEN 1 AND 5  -- Monday to Friday
    );
    
    IF NOT is_business_hours THEN
        -- Log after-hours access attempt  
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_off_hours', 'high', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 
                                'hour', EXTRACT(hour FROM now()), 'dow', EXTRACT(dow FROM now())));
        RETURN false;
    END IF;
    
    -- Log successful access for audit
    INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES ('trade_secret_access_granted', 'info', 
           jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 'time', now()));
    
    RETURN true;
END;
$$;

-- 4. Update table comment for security documentation
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with enhanced security. Trade secret classification enforces admin-only access during business hours with comprehensive logging to prevent industrial espionage.';