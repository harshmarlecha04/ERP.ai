-- SIMPLE CRITICAL FIX: Just upgrade the formula classifications
-- The security infrastructure is already in place, we just need to reclassify

-- Direct update of formula security levels to protect against industrial espionage
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
) 
AND NOT is_deleted
AND security_level != 'trade_secret';

-- Add the emergency lockdown capability  
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='enable_formula_emergency_lockdown' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.enable_formula_emergency_lockdown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    UPDATE public.security_config 
    SET config_value = jsonb_set(config_value, '{enabled}', 'true')
    WHERE config_key = 'emergency_lockdown';
END;
$$;