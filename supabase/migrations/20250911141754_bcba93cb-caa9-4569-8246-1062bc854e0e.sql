-- Update business hours enforcement from 8 AM - 5 PM to 7 AM - 6 PM EST
-- This affects trade secret access validation functions

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_trade_secret_access_strict' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_strict(_user_id uuid, _formula_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    is_business_hours boolean := false;
    user_has_admin_role boolean := false;
    emergency_lockdown boolean := false;
BEGIN
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        -- Log lockdown access attempt
DO $aud$ BEGIN INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_emergency_blocked', 'critical', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id)); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
        RETURN false;
    END IF;
    
    -- STRICT: Only admins can access trade secrets (period)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        -- Log unauthorized access attempt
DO $aud$ BEGIN INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_unauthorized', 'critical', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id)); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
        RETURN false;
    END IF;
    
    -- Enforce business hours (7 AM to 6 PM weekdays only) - UPDATED HOURS
    is_business_hours := (
        EXTRACT(hour FROM now()) BETWEEN 7 AND 17 AND  -- Changed from 8-17 to 7-17 (7 AM to 6 PM)
        EXTRACT(dow FROM now()) BETWEEN 1 AND 5  -- Monday to Friday
    );
    
    IF NOT is_business_hours THEN
        -- Log after-hours access attempt  
DO $aud$ BEGIN INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES ('trade_secret_off_hours', 'high', 
               jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 
                                'hour', EXTRACT(hour FROM now()), 'dow', EXTRACT(dow FROM now()))); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
        RETURN false;
    END IF;
    
    -- Log successful access for audit
DO $aud$ BEGIN INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES ('trade_secret_access_granted', 'low', 
           jsonb_build_object('user_id', _user_id, 'formula_id', _formula_id, 'time', now())); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
    
    RETURN true;
END;
$function$;

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_trade_secret_access_secure_v2' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_secure_v2(_user_id uuid, _formula_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    is_business_hours boolean := false;
    user_has_admin_role boolean := false;
    emergency_lockdown boolean := false;
BEGIN
    -- Handle null user (system operations)
    IF _user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        RETURN false;
    END IF;
    
    -- Only admins can access trade secrets
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        RETURN false;
    END IF;
    
    -- Check business hours (7 AM to 6 PM) - UPDATED HOURS
    is_business_hours := EXTRACT(hour FROM now()) BETWEEN 7 AND 17;  -- Changed from 8-17 to 7-17
    IF NOT is_business_hours THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$function$;

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_access_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'view'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    formula_security_level text;
    user_has_role boolean := false;
    has_explicit_permission boolean := false;
    emergency_mode boolean := false;
    current_time timestamp with time zone := now();
    permission_record record;
    access_hour integer;
BEGIN
    -- Input validation
    IF _user_id IS NULL OR _formula_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_mode
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_mode THEN
        -- Only allow admins during emergency
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = _user_id AND role = 'admin'
        ) INTO user_has_role;
        
        IF NOT user_has_role THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_emergency', 
                jsonb_build_object('reason', 'emergency_lockdown_active'));
            RETURN false;
        END IF;
    END IF;
    
    -- Get formula security level
    SELECT security_level INTO formula_security_level
    FROM public.formulas 
    WHERE id = _formula_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check if user is admin (admins have access to all formulas)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_role;
    
    IF user_has_role THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'admin_access', 
            jsonb_build_object('access_type', _access_type));
        RETURN true;
    END IF;
    
    -- For trade secret formulas, implement enhanced security
    IF formula_security_level = 'trade_secret' THEN
        -- Check business hours (7 AM to 6 PM) - UPDATED HOURS
        access_hour := EXTRACT(hour FROM current_time);
        IF access_hour < 7 OR access_hour >= 18 THEN  -- Changed from < 8 OR >= 18 to < 7 OR >= 18
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_hours', 
                jsonb_build_object('hour', access_hour));
            RETURN false;
        END IF;
        
        -- Check for valid explicit permission with required approvals
        SELECT * INTO permission_record
        FROM public.formula_user_permissions 
        WHERE formula_id = _formula_id 
        AND user_id = _user_id 
        AND permission_type IN (_access_type, 'admin')
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > current_time)
        AND approval_count >= required_approvals;
        
        IF NOT FOUND THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_no_permission', 
                jsonb_build_object('access_type', _access_type, 'security_level', formula_security_level));
            RETURN false;
        END IF;
        
        -- Update usage tracking
        UPDATE public.formula_user_permissions 
        SET last_used_at = current_time, usage_count = usage_count + 1
        WHERE id = permission_record.id;
        
        PERFORM public.log_formula_access(_user_id, _formula_id, 'trade_secret_access', 
            jsonb_build_object('permission_id', permission_record.id, 'access_type', _access_type));
        RETURN true;
    END IF;
    
    -- For confidential formulas, check for R&D manager role or explicit permission
    IF formula_security_level = 'confidential' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = _user_id AND role = 'rd_manager'
        ) INTO user_has_role;
        
        IF user_has_role THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'rd_manager_access', 
                jsonb_build_object('access_type', _access_type));
            RETURN true;
        END IF;
        
        -- Check explicit permission
        SELECT EXISTS (
            SELECT 1 FROM public.formula_user_permissions 
            WHERE formula_id = _formula_id 
            AND user_id = _user_id 
            AND permission_type IN (_access_type, 'admin', 'edit')
            AND is_active = true
            AND (expires_at IS NULL OR expires_at > current_time)
        ) INTO has_explicit_permission;
        
        IF has_explicit_permission THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'explicit_permission_access', 
                jsonb_build_object('access_type', _access_type));
            RETURN true;
        END IF;
        
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_confidential', 
            jsonb_build_object('access_type', _access_type));
        RETURN false;
    END IF;
    
    -- For standard formulas, check for any production role or explicit permission
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role IN ('admin', 'rd_manager', 'production_manager')
    ) INTO user_has_role;
    
    IF user_has_role THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'role_based_access', 
            jsonb_build_object('access_type', _access_type));
        RETURN true;
    END IF;
    
    -- Final check for explicit permission
    SELECT EXISTS (
        SELECT 1 FROM public.formula_user_permissions 
        WHERE formula_id = _formula_id 
        AND user_id = _user_id 
        AND permission_type IN (_access_type, 'admin', 'edit')
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > current_time)
    ) INTO has_explicit_permission;
    
    IF has_explicit_permission THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'explicit_permission_access', 
            jsonb_build_object('access_type', _access_type));
        RETURN true;
    END IF;
    
    -- Access denied
    PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_general', 
        jsonb_build_object('access_type', _access_type, 'security_level', formula_security_level));
    RETURN false;
END;
$function$;