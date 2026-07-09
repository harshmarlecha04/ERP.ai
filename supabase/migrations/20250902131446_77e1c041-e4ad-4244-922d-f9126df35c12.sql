-- Simplified Formula Security Hardening - Working Implementation
-- Focus on core security enhancements without complex dependencies

-- 1. Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;

-- 2. Recreate the security validation trigger
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;
CREATE TRIGGER formula_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_formula_security_level();

-- 3. Add unique constraint to security_config if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_security_config_key' 
        AND table_name = 'security_config'
    ) THEN
        ALTER TABLE public.security_config 
        ADD CONSTRAINT unique_security_config_key UNIQUE (config_key);
    END IF;
END $$;

-- 4. Insert default security configurations
INSERT INTO public.security_config (config_key, config_value)
VALUES 
    (
        'trade_secret_ip_restrictions',
        jsonb_build_object(
            'enabled', false,
            'allowed_networks', ARRAY['0.0.0.0/0'],
            'description', 'IP restrictions for trade secret access'
        )
    ),
    (
        'formula_security_settings',
        jsonb_build_object(
            'enhanced_logging', true,
            'auto_alert_threshold', 5,
            'session_timeout_minutes', 60
        )
    )
ON CONFLICT (config_key) DO NOTHING;

-- 5. Create a simple function to get security overview
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_security_overview' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_security_overview()
RETURNS jsonb AS $$
DECLARE
    formula_count integer;
    trade_secret_count integer;
    alert_count integer;
    result jsonb;
BEGIN
    -- Only allow admins to view security overview
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('error', 'Access denied');
    END IF;
    
    -- Get basic counts
    SELECT COUNT(*) INTO formula_count FROM public.formulas WHERE NOT is_deleted;
    SELECT COUNT(*) INTO trade_secret_count FROM public.formulas 
    WHERE classification_level = 'trade_secret' AND NOT is_deleted;
    SELECT COUNT(*) INTO alert_count FROM public.security_alerts 
    WHERE created_at > now() - interval '7 days';
    
    result := jsonb_build_object(
        'formulas', formula_count,
        'trade_secrets', trade_secret_count,
        'recent_alerts', alert_count,
        'security_status', 'enhanced',
        'last_check', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Verify the security implementation is working
SELECT 
    t.tgname as trigger_name,
    'active' as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname = 'formulas'
AND t.tgname = 'formula_security_validation_trigger';