-- Final Formula Security Hardening - Complete Implementation
-- Drop and recreate security components to ensure clean implementation

-- 1. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;

-- 2. Recreate the security validation trigger
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;
CREATE TRIGGER formula_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_formula_security_level();

-- 3. Add unique constraint to security_config to prevent conflicts
ALTER TABLE public.security_config DROP CONSTRAINT IF EXISTS unique_security_config_key;
ALTER TABLE public.security_config 
ADD CONSTRAINT unique_security_config_key 
UNIQUE (config_key);

-- 4. Insert default IP restrictions config for trade secrets (can be updated by admins)
INSERT INTO public.security_config (config_key, config_value)
VALUES (
    'trade_secret_ip_restrictions',
    jsonb_build_object(
        'enabled', false,
        'allowed_networks', ARRAY['0.0.0.0/0'],
        'description', 'IP restrictions for trade secret access. Update allowed_networks to restrict access.'
    )
)
ON CONFLICT (config_key) DO NOTHING;

-- 5. Create a function to deactivate emergency lockdown
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='deactivate_emergency_lockdown' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.deactivate_emergency_lockdown()
RETURNS jsonb AS $$
BEGIN
    -- Only admins can deactivate emergency lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Update emergency lockdown config
    UPDATE public.security_config 
    SET config_value = jsonb_build_object(
        'enabled', false,
        'deactivated_at', now(),
        'deactivated_by', auth.uid()
    ),
    updated_at = now()
    WHERE config_key = 'emergency_lockdown';
    
    -- Log the deactivation
    INSERT INTO public.security_alerts (
        alert_type,
        severity,
        details
    ) VALUES (
        'emergency_lockdown_deactivated',
        'medium',
        jsonb_build_object(
            'deactivated_by', auth.uid(),
            'timestamp', now()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Emergency lockdown deactivated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create documentation comments for the security system
COMMENT ON TABLE public.security_alerts IS 
'Security alerts table for monitoring critical access attempts and security events. 
Alerts are generated automatically for high-risk formula access and security violations.';

COMMENT ON FUNCTION public.emergency_formula_lockdown(text) IS 
'Emergency lockdown function to immediately restrict all formula access except for admins. 
Use in case of suspected security breach or unauthorized access attempts.';

COMMENT ON FUNCTION public.get_formula_security_status() IS 
'Comprehensive security monitoring function that provides security status overview.
Returns counts of formulas by classification, active sessions, and recent security alerts.';

COMMENT ON FUNCTION public.log_formula_access_enhanced(uuid, uuid, text, jsonb) IS 
'Enhanced audit logging function for all formula access attempts.
Automatically assesses risk levels and generates security alerts for suspicious activity.';

-- 7. Success confirmation query
SELECT 
    'Formula security hardening completed successfully' as status,
    COUNT(*) as total_security_functions
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%formula%security%';