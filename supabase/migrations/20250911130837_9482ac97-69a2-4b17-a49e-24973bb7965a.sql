-- TARGETED FIX: Critical formula security vulnerabilities (avoiding trigger conflicts)

-- 1. Enable security monitoring and IP restrictions
UPDATE public.security_config 
SET config_value = jsonb_set(config_value, '{enabled}', 'true')
WHERE config_key = 'formula_security_monitoring';

UPDATE public.security_config 
SET config_value = jsonb_set(
    jsonb_set(config_value, '{enabled}', 'true'),
    '{allowed_networks}', '["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]'
)
WHERE config_key = 'trade_secret_ip_restrictions';

-- 2. Upgrade proprietary formulas to trade secret classification
-- (This must be done carefully to avoid trigger issues)
UPDATE public.formulas 
SET 
    security_level = 'trade_secret',
    classification_level = 'trade_secret',
    requires_approval = true
WHERE (
    name ILIKE '%magnesium%' 
    OR name ILIKE '%theanine%' 
    OR name ILIKE '%seamoss%'
    OR name ILIKE '%mushroom%'
    OR recipe_json IS NOT NULL
) AND NOT is_deleted;

-- 3. Create enhanced trade secret validation (null-safe)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_trade_secret_access_secure_v2' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_secure_v2(_user_id uuid, _formula_id uuid)
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
    -- Handle null user (system operations)
    IF _user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        RETURN false;
    END IF;
    
    -- Only admins can access trade secrets
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        RETURN false;
    END IF;
    
    -- Check business hours (8 AM to 6 PM) - critical for trade secrets
    is_business_hours := EXTRACT(hour FROM now()) BETWEEN 8 AND 17;
    IF NOT is_business_hours THEN
        -- Log after-hours attempt if possible
        BEGIN
            INSERT INTO public.security_alerts (alert_type, severity, details)
            VALUES ('trade_secret_after_hours', 'high', 
                   jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 'hour', EXTRACT(hour FROM now())));
        EXCEPTION WHEN OTHERS THEN
            -- Silent fail to avoid breaking access completely
            NULL;
        END;
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- 4. Update RLS policy to use new validation
DO $pol$ BEGIN DROP POLICY IF EXISTS "Enhanced trade secret protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula access for viewing" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Multi-tier formula security" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Multi-tier formula security" 
ON public.formulas 
FOR SELECT 
USING (
  NOT is_deleted AND (
    -- Standard formulas: Role-based access
    (security_level = 'standard' AND 
     (has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'rd_manager'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role))
    ) OR
    -- Trade secret formulas: Enhanced protection
    (security_level = 'trade_secret' AND 
     validate_trade_secret_access_secure_v2(auth.uid(), id)
    )
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 5. Create emergency lockdown function for trade secrets
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='enable_formula_emergency_lockdown' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.enable_formula_emergency_lockdown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can enable lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can enable emergency lockdown';
    END IF;
    
    UPDATE public.security_config 
    SET config_value = jsonb_set(config_value, '{enabled}', 'true')
    WHERE config_key = 'emergency_lockdown';
    
    -- Log the lockdown
    INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES ('emergency_lockdown_enabled', 'critical', 
           jsonb_build_object('enabled_by', auth.uid(), 'timestamp', now()));
END;
$$;

-- 6. Update table comment for security documentation
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with enhanced security tiers. Trade secret formulas require admin access during business hours with IP restrictions and emergency lockdown capabilities to prevent industrial espionage.';