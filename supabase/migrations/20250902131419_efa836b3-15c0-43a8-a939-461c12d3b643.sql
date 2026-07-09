-- Complete Formula Security Implementation - Final Version
-- This completes the enhanced security for proprietary formulas

-- 1. Add unique constraint to security_config to prevent conflicts
ALTER TABLE public.security_config DROP CONSTRAINT IF EXISTS unique_security_config_key;
ALTER TABLE public.security_config 
ADD CONSTRAINT unique_security_config_key 
UNIQUE (config_key);

-- 2. Insert default security configurations
INSERT INTO public.security_config (config_key, config_value)
VALUES 
    (
        'trade_secret_ip_restrictions',
        jsonb_build_object(
            'enabled', false,
            'allowed_networks', ARRAY['0.0.0.0/0'],
            'description', 'IP restrictions for trade secret access. Update allowed_networks to restrict access.'
        )
    ),
    (
        'formula_security_monitoring',
        jsonb_build_object(
            'enabled', true,
            'alert_threshold', 5,
            'description', 'Enhanced monitoring for formula access patterns and security events.'
        )
    )
ON CONFLICT (config_key) DO NOTHING;

-- 3. Create function to get security summary for admins
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_security_summary' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_security_summary()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    -- Only admins can view security summary
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('error', 'Access denied');
    END IF;
    
    SELECT jsonb_build_object(
        'total_formulas', (SELECT COUNT(*) FROM public.formulas WHERE NOT is_deleted),
        'trade_secret_formulas', (SELECT COUNT(*) FROM public.formulas WHERE classification_level = 'trade_secret' AND NOT is_deleted),
        'confidential_formulas', (SELECT COUNT(*) FROM public.formulas WHERE classification_level = 'confidential' AND NOT is_deleted),
        'recent_alerts', (SELECT COUNT(*) FROM public.security_alerts WHERE created_at > now() - interval '24 hours'),
        'active_trade_secret_sessions', (SELECT COUNT(*) FROM public.trade_secret_access_sessions WHERE is_active = true),
        'emergency_lockdown_active', (
            SELECT COALESCE((config_value->>'enabled')::boolean, false) 
            FROM public.security_config 
            WHERE config_key = 'emergency_lockdown'
        ),
        'last_updated', now()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Add helpful documentation
COMMENT ON TABLE public.security_alerts IS 
'Security alerts for monitoring critical access attempts and security violations';

COMMENT ON TABLE public.formulas IS 
'Formulas table with enhanced security controls for trade secret and confidential data';

COMMENT ON FUNCTION public.get_security_summary() IS 
'Admin function to get comprehensive security status overview';

-- 5. Verify the security implementation
SELECT 
    'Formula Security Implementation Completed' as message,
    jsonb_build_object(
        'security_functions_created', (
            SELECT COUNT(*) FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name IN (
                'log_formula_access_enhanced',
                'validate_formula_security_level', 
                'get_security_summary',
                'is_emergency_lockdown_active'
            )
        ),
        'security_tables', (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'security_alerts'
        ),
        'formula_triggers', (
            SELECT COUNT(*) FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND event_object_table = 'formulas'
            AND trigger_name = 'formula_security_validation_trigger'
        )
    ) as implementation_status;