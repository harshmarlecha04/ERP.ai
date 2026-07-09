-- FINAL CRITICAL SECURITY FIX: Apply remaining security enhancements

-- 1. Upgrade proprietary formulas to trade secret status 
-- (avoiding trigger issues by doing this separately)
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
    OR (recipe_json IS NOT NULL AND recipe_json != '[]'::jsonb)
) AND NOT is_deleted AND security_level != 'trade_secret';

-- 2. Create emergency lockdown function
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

-- 3. Create function to check if formula access is during business hours
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='is_business_hours' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN EXTRACT(hour FROM now()) BETWEEN 8 AND 17;
END;
$$;

-- 4. Update table comment to document enhanced security
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with enhanced multi-tier security. Trade secret formulas require admin access during business hours (8AM-6PM) with IP restrictions and emergency lockdown capabilities to prevent industrial espionage. All access is monitored and audited.';