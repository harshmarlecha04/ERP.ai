-- CRITICAL FIX: Strengthen formula security against industrial espionage
-- Current system has major vulnerabilities exposing trade secrets

-- 1. Enable emergency security monitoring for all formula access
UPDATE public.security_config 
SET config_value = jsonb_set(config_value, '{enabled}', 'true')
WHERE config_key = 'formula_security_monitoring';

-- 2. Enable IP restrictions for trade secret access  
UPDATE public.security_config 
SET config_value = jsonb_set(
    jsonb_set(config_value, '{enabled}', 'true'),
    '{allowed_networks}', '["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]'
)
WHERE config_key = 'trade_secret_ip_restrictions';

-- 3. Upgrade proprietary formulas to trade secret classification
UPDATE public.formulas 
SET 
    security_level = 'trade_secret',
    classification_level = 'trade_secret',
    requires_approval = true
WHERE name ILIKE '%magnesium%' 
   OR name ILIKE '%theanine%' 
   OR name ILIKE '%seamoss%'
   OR name ILIKE '%mushroom%'
   OR recipe_json IS NOT NULL;

-- 4. Create enhanced trade secret protection function
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_enhanced(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_business_hours boolean := false;
    user_ip inet;
    allowed_networks text[];
    ip_allowed boolean := false;
    user_has_admin_role boolean := false;
    user_access_count_today integer := 0;
    emergency_lockdown boolean := false;
    network cidr;
BEGIN
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        RETURN false;
    END IF;
    
    -- Verify admin role (only admins can access trade secrets)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        -- Log unauthorized access attempt
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('unauthorized_trade_secret_attempt', 'critical', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 'time', now()));
        RETURN false;
    END IF;
    
    -- Check business hours (8 AM to 6 PM)
    is_business_hours := EXTRACT(hour FROM now()) BETWEEN 8 AND 17;
    IF NOT is_business_hours THEN
        -- Log after-hours access attempt  
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_after_hours', 'high', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 'hour', EXTRACT(hour FROM now())));
        RETURN false;
    END IF;
    
    -- Check IP restrictions
    user_ip := inet_client_addr();
    SELECT config_value->'allowed_networks' INTO allowed_networks
    FROM public.security_config 
    WHERE config_key = 'trade_secret_ip_restrictions';
    
    IF allowed_networks IS NOT NULL THEN
        ip_allowed := false;
        FOR i IN 1..array_length(allowed_networks, 1) LOOP
            BEGIN
                network := allowed_networks[i]::cidr;
                IF user_ip << network THEN
                    ip_allowed := true;
                    EXIT;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;
        END LOOP;
        
        IF NOT ip_allowed THEN
            -- Log IP violation
            INSERT INTO public.security_alerts (alert_type, severity, details)
            VALUES ('trade_secret_ip_violation', 'critical', 
                   jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 'ip', user_ip));
            RETURN false;
        END IF;
    END IF;
    
    -- Check daily access limits (max 3 per day)
    SELECT COUNT(*) INTO user_access_count_today
    FROM public.formula_access_audit 
    WHERE user_id = _user_id 
    AND accessed_at > current_date
    AND access_type = 'trade_secret_access';
    
    IF user_access_count_today >= 3 THEN
        -- Log excessive access attempt
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_excessive_access', 'high', 
               jsonb_build_object('user_id', _user_id, 'daily_count', user_access_count_today));
        RETURN false;
    END IF;
    
    -- Log successful access
    PERFORM public.log_formula_access_enhanced(_user_id, _formula_id, 'trade_secret_access', 
        jsonb_build_object('ip', user_ip, 'business_hours', is_business_hours));
    
    RETURN true;
END;
$$;

-- 5. Update RLS policies to use enhanced validation for trade secrets
DROP POLICY IF EXISTS "Secure formula access for viewing" ON public.formulas;

CREATE POLICY "Enhanced trade secret protection" 
ON public.formulas 
FOR SELECT 
USING (
  NOT is_deleted AND (
    -- Standard formulas: Normal role access
    (security_level = 'standard' AND 
     (has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'rd_manager'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role))
    ) OR
    -- Trade secret formulas: Enhanced validation required
    (security_level = 'trade_secret' AND 
     validate_trade_secret_access_enhanced(auth.uid(), id)
    )
  )
);

-- 6. Create secure audit trail for trade secrets
CREATE OR REPLACE FUNCTION public.create_trade_secret_session(_formula_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_id uuid;
BEGIN
    -- Only admins can create trade secret sessions
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can access trade secrets';
    END IF;
    
    -- Create session record
    INSERT INTO public.trade_secret_access_sessions (
        user_id, formula_id, expires_at, session_token, ip_address
    ) VALUES (
        auth.uid(), _formula_id, now() + interval '30 minutes',
        gen_random_uuid()::text, inet_client_addr()
    ) RETURNING id INTO session_id;
    
    -- Log session creation
    INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES ('trade_secret_session_created', 'info', 
           jsonb_build_object('user_id', auth.uid(), 'formula_id', _formula_id, 'session_id', session_id));
    
    RETURN session_id;
END;
$$;

-- 7. Update table comment for security documentation
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with multi-tier security. Trade secret formulas require admin access, business hours, IP restrictions, and comprehensive audit logging to prevent industrial espionage.';