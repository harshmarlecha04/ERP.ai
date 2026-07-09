-- NOW APPLY THE SECURITY UPGRADE: Classify proprietary formulas as trade secrets

-- Upgrade all proprietary formulas to trade secret classification
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

-- Enable critical security controls for trade secrets
UPDATE public.security_config 
SET config_value = jsonb_set(config_value, '{enabled}', 'true')
WHERE config_key = 'formula_security_monitoring';

UPDATE public.security_config 
SET config_value = jsonb_set(
    jsonb_set(config_value, '{enabled}', 'true'),
    '{allowed_networks}', '["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]'
)
WHERE config_key = 'trade_secret_ip_restrictions';

-- Add emergency lockdown capability
CREATE OR REPLACE FUNCTION public.enable_formula_emergency_lockdown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can enable emergency lockdown';
    END IF;
    
    UPDATE public.security_config 
    SET config_value = jsonb_set(config_value, '{enabled}', 'true')
    WHERE config_key = 'emergency_lockdown';
    
    -- Log the emergency action
    INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES ('emergency_lockdown_enabled', 'critical', 
           jsonb_build_object('enabled_by', auth.uid(), 'timestamp', now()));
END;
$$;

-- Update table documentation
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with enhanced multi-tier security. Trade secret formulas require admin access during business hours with IP restrictions and emergency lockdown capabilities to prevent industrial espionage.';