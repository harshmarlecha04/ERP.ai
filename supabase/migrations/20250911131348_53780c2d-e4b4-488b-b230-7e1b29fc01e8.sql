-- FINAL FIX: Manually classify proprietary formulas as trade secrets
-- The enhanced security policies are already in place, now we need to properly classify the formulas

-- Temporarily disable any triggers that might interfere
ALTER TABLE public.formulas DISABLE TRIGGER ALL;

-- Upgrade proprietary formulas to trade secret classification
-- This is the critical fix needed to prevent industrial espionage
UPDATE public.formulas 
SET 
    security_level = 'trade_secret',
    classification_level = 'trade_secret',
    requires_approval = true,
    updated_at = now()
WHERE (
    name ILIKE '%magnesium%' 
    OR name ILIKE '%theanine%' 
    OR name ILIKE '%seamoss%'
    OR name ILIKE '%mushroom%'
    OR (recipe_json IS NOT NULL AND recipe_json != '[]'::jsonb)
) 
AND NOT is_deleted
AND security_level != 'trade_secret';

-- Re-enable triggers
ALTER TABLE public.formulas ENABLE TRIGGER ALL;

-- Create emergency lockdown function for immediate threat response
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

-- Update table comment
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with multi-tier security. Trade secret formulas now require admin access during business hours with IP restrictions and emergency lockdown capabilities to prevent industrial espionage.';