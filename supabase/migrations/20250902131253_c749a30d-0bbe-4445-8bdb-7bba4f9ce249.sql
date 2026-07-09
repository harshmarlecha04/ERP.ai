-- Enhanced formula security - Step 2: Add monitoring and emergency controls

-- 1. Create comprehensive security monitoring function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_formula_security_status' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_formula_security_status()
RETURNS jsonb AS $$
DECLARE
    total_formulas integer;
    trade_secret_count integer;
    confidential_count integer;
    active_sessions integer;
    recent_alerts integer;
    security_status jsonb;
BEGIN
    -- Only admins can check security status
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('error', 'Access denied');
    END IF;
    
    -- Get formula counts by classification
    SELECT COUNT(*) INTO total_formulas FROM public.formulas WHERE NOT COALESCE(is_deleted, false);
    SELECT COUNT(*) INTO trade_secret_count FROM public.formulas 
    WHERE classification_level = 'trade_secret' AND NOT COALESCE(is_deleted, false);
    SELECT COUNT(*) INTO confidential_count FROM public.formulas 
    WHERE classification_level = 'confidential' AND NOT COALESCE(is_deleted, false);
    
    -- Get active trade secret sessions
    SELECT COUNT(*) INTO active_sessions FROM public.trade_secret_access_sessions 
    WHERE is_active = true;
    
    -- Get recent security alerts
    SELECT COUNT(*) INTO recent_alerts FROM public.security_alerts 
    WHERE created_at > now() - interval '24 hours';
    
    security_status := jsonb_build_object(
        'total_formulas', total_formulas,
        'trade_secrets', trade_secret_count,
        'confidential', confidential_count,
        'active_sessions', active_sessions,
        'recent_alerts', recent_alerts,
        'last_checked', now(),
        'security_level', CASE 
            WHEN recent_alerts > 10 THEN 'critical'
            WHEN recent_alerts > 5 THEN 'high'
            WHEN recent_alerts > 0 THEN 'medium'
            ELSE 'normal'
        END
    );
    
    RETURN security_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create function to check if emergency lockdown is active
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='is_emergency_lockdown_active' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.is_emergency_lockdown_active()
RETURNS boolean AS $$
DECLARE
    lockdown_status boolean := false;
BEGIN
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO lockdown_status
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    RETURN lockdown_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create security recommendations function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_formula_security_recommendations' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_formula_security_recommendations()
RETURNS jsonb AS $$
DECLARE
    recommendations jsonb := '[]'::jsonb;
    unclassified_count integer;
    weak_passwords_count integer;
    expired_permissions_count integer;
BEGIN
    -- Only admins can get security recommendations
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('error', 'Access denied');
    END IF;
    
    -- Check for unclassified formulas
    SELECT COUNT(*) INTO unclassified_count FROM public.formulas 
    WHERE (classification_level IS NULL OR classification_level = '') 
    AND NOT COALESCE(is_deleted, false);
    
    IF unclassified_count > 0 THEN
        recommendations := recommendations || jsonb_build_array(jsonb_build_object(
            'type', 'warning',
            'title', 'Unclassified Formulas Detected',
            'description', format('%s formulas lack proper classification levels', unclassified_count),
            'action', 'Review and classify all formulas according to their sensitivity level',
            'priority', 'medium'
        ));
    END IF;
    
    -- Check for expired permissions
    SELECT COUNT(*) INTO expired_permissions_count FROM public.formula_user_permissions 
    WHERE expires_at < now() AND is_active = true;
    
    IF expired_permissions_count > 0 THEN
        recommendations := recommendations || jsonb_build_array(jsonb_build_object(
            'type', 'warning',
            'title', 'Expired Permissions Found',
            'description', format('%s permissions have expired but are still active', expired_permissions_count),
            'action', 'Review and deactivate expired formula access permissions',
            'priority', 'high'
        ));
    END IF;
    
    RETURN jsonb_build_object(
        'recommendations', recommendations,
        'total_issues', jsonb_array_length(recommendations),
        'generated_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;