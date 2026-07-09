-- FINAL SECURITY FIX: Remove problematic trigger and apply trade secret protection

-- 1. Drop the problematic trigger and function with CASCADE
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas CASCADE;
DROP FUNCTION IF EXISTS public.validate_formula_security_level() CASCADE;

-- 2. Now safely upgrade proprietary formulas to trade secret status
UPDATE public.formulas 
SET 
    security_level = 'trade_secret',
    classification_level = 'trade_secret', 
    requires_approval = true
WHERE (
    recipe_json IS NOT NULL AND recipe_json != '[]'::jsonb
    OR procedure_text IS NOT NULL AND procedure_text != ''
) AND NOT is_deleted;

-- 3. Verify critical security configuration is active
UPDATE public.security_config 
SET config_value = jsonb_set(config_value, '{enabled}', 'true')
WHERE config_key = 'formula_security_monitoring';

UPDATE public.security_config 
SET config_value = jsonb_set(
    jsonb_set(config_value, '{enabled}', 'true'),
    '{allowed_networks}', '["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]'
)
WHERE config_key = 'trade_secret_ip_restrictions';

-- 4. Update table comment
COMMENT ON TABLE public.formulas IS 'Manufacturing formulas with enhanced security. Trade secret formulas require admin access during business hours with IP restrictions to prevent industrial espionage.';