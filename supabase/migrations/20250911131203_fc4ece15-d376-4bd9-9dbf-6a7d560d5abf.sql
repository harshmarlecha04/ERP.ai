-- FINAL STEP: Upgrade proprietary formulas to trade secret classification

-- Upgrade all formulas with recipe data to trade secret status
-- This is done after the security infrastructure is in place
UPDATE public.formulas 
SET 
    security_level = 'trade_secret',
    classification_level = 'trade_secret',
    requires_approval = true
WHERE (
    recipe_json IS NOT NULL AND recipe_json != '[]'::jsonb
    OR procedure_text IS NOT NULL AND procedure_text != ''
    OR name ILIKE '%proprietary%'
    OR name ILIKE '%magnesium%' 
    OR name ILIKE '%theanine%' 
    OR name ILIKE '%seamoss%'
    OR name ILIKE '%mushroom%'
) AND NOT is_deleted;

-- Update table comment to reflect new security posture
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with multi-tier security. Trade secret formulas (containing recipes/procedures) require admin access during business hours (8-6PM) with IP restrictions and emergency lockdown capabilities to prevent industrial espionage.';

-- Create emergency lockdown function
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
END;
$$;