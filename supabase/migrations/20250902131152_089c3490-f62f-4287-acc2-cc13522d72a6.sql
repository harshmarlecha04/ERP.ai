-- Comprehensive Formula Security Hardening - Complete Implementation
-- This addresses the critical security vulnerability in proprietary formula access

-- 1. Enhanced audit logging function (already created in previous migration)
-- log_formula_access_enhanced() is already available

-- 2. Create security alerts table (already created)
-- security_alerts table is already available

-- 3. Create formula security validation function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_security_level' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_formula_security_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Enforce security level requirements for trade secrets
    IF NEW.classification_level = 'trade_secret' THEN
        -- Trade secrets must have highest security level
        IF NEW.security_level NOT IN ('confidential', 'trade_secret') THEN
            RAISE EXCEPTION 'Trade secret formulas must have confidential or trade_secret security level';
        END IF;
        
        -- Trade secrets require approval flag
        NEW.requires_approval := true;
        
        -- Log the trade secret creation/modification
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            NEW.id,
            'trade_secret_modification',
            jsonb_build_object(
                'operation', TG_OP,
                'security_enforcement', 'trade_secret_validation',
                'previous_classification', COALESCE(OLD.classification_level, 'none')
            )
        );
    END IF;
    
    -- Prevent downgrading security levels without admin approval
    IF TG_OP = 'UPDATE' AND OLD.classification_level IS NOT NULL THEN
        IF NEW.classification_level != OLD.classification_level THEN
            IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
                RAISE EXCEPTION 'Only admins can change formula classification levels';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create the security validation trigger
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;
CREATE TRIGGER formula_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_formula_security_level();

-- 5. Create emergency lockdown function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='emergency_formula_lockdown' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.emergency_formula_lockdown(
    _reason text DEFAULT 'Emergency lockdown activated'
)
RETURNS jsonb AS $$
DECLARE
    affected_count integer;
BEGIN
    -- Only admins can trigger emergency lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Insert or update emergency lockdown config
    INSERT INTO public.security_config (config_key, config_value)
    VALUES (
        'emergency_lockdown',
        jsonb_build_object(
            'enabled', true,
            'activated_at', now(),
            'activated_by', auth.uid(),
            'reason', _reason
        )
    )
    ON CONFLICT (config_key) 
    DO UPDATE SET 
        config_value = jsonb_build_object(
            'enabled', true,
            'activated_at', now(),
            'activated_by', auth.uid(),
            'reason', _reason
        ),
        updated_at = now();
    
    -- Terminate all active trade secret sessions
    UPDATE public.trade_secret_access_sessions
    SET is_active = false,
        terminated_at = now(),
        terminated_reason = 'emergency_lockdown'
    WHERE is_active = true;
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    -- Log the emergency lockdown
    INSERT INTO public.security_alerts (
        alert_type,
        severity,
        details
    ) VALUES (
        'emergency_lockdown_activated',
        'critical',
        jsonb_build_object(
            'activated_by', auth.uid(),
            'reason', _reason,
            'sessions_terminated', affected_count,
            'timestamp', now()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Emergency lockdown activated',
        'sessions_terminated', affected_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create function to check emergency lockdown status
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

-- 7. Create comprehensive security monitoring function
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
    SELECT COUNT(*) INTO total_formulas FROM public.formulas WHERE NOT is_deleted;
    SELECT COUNT(*) INTO trade_secret_count FROM public.formulas 
    WHERE classification_level = 'trade_secret' AND NOT is_deleted;
    SELECT COUNT(*) INTO confidential_count FROM public.formulas 
    WHERE classification_level = 'confidential' AND NOT is_deleted;
    
    -- Get active trade secret sessions
    SELECT COUNT(*) INTO active_sessions FROM public.trade_secret_access_sessions 
    WHERE is_active = true;
    
    -- Get recent security alerts (last 24 hours)
    SELECT COUNT(*) INTO recent_alerts FROM public.security_alerts 
    WHERE created_at > now() - interval '24 hours';
    
    security_status := jsonb_build_object(
        'total_formulas', total_formulas,
        'trade_secrets', trade_secret_count,
        'confidential', confidential_count,
        'active_sessions', active_sessions,
        'recent_alerts', recent_alerts,
        'emergency_lockdown', is_emergency_lockdown_active(),
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