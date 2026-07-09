-- Update only the functions to give admins unrestricted access
-- The RLS policy is already correct

-- Update validate_trade_secret_access_enhanced to allow admin unrestricted access
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_enhanced(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_hour integer;
    current_day integer;
    is_business_hours boolean := false;
    is_admin boolean := false;
    lockdown_active boolean := false;
    suspicious_activity boolean := false;
BEGIN
    -- Check if user is admin - admins get unrestricted access
    SELECT has_role(_user_id, 'admin'::app_role) INTO is_admin;
    
    -- Admins bypass all time and security restrictions
    IF is_admin THEN
        -- Log admin access for audit trail
        PERFORM public.log_formula_access_enhanced(
            _user_id,
            _formula_id,
            'admin_unrestricted_access',
            jsonb_build_object(
                'security_level', 'trade_secret',
                'access_time', now(),
                'business_hours_bypass', true,
                'admin_override', true
            )
        );
        RETURN true;
    END IF;
    
    -- For non-admin users, apply all restrictions
    -- Calculate business hours (7 AM - 6 PM EST, Monday-Friday)
    current_hour := EXTRACT(hour FROM (now() AT TIME ZONE 'America/New_York'));
    current_day := EXTRACT(dow FROM (now() AT TIME ZONE 'America/New_York'));
    
    -- Business hours: Monday-Friday (1-5), 7 AM - 6 PM EST
    is_business_hours := (current_day BETWEEN 1 AND 5) AND (current_hour BETWEEN 7 AND 17);
    
    -- Check for emergency lockdown
    SELECT EXISTS (
        SELECT 1 FROM public.security_config 
        WHERE config_key = 'emergency_lockdown' 
        AND (config_value->>'active')::boolean = true
    ) INTO lockdown_active;
    
    -- Check for suspicious activity (simplified check)
    SELECT EXISTS (
        SELECT 1 FROM public.formula_access_audit 
        WHERE user_id = _user_id 
        AND accessed_at > now() - interval '1 hour'
        AND access_type = 'suspicious_activity'
    ) INTO suspicious_activity;
    
    -- Non-admin users must meet all security requirements
    IF lockdown_active THEN
        PERFORM public.log_formula_access_enhanced(
            _user_id,
            _formula_id,
            'access_denied_lockdown',
            jsonb_build_object(
                'reason', 'emergency_lockdown_active',
                'timestamp', now()
            )
        );
        RETURN false;
    END IF;
    
    IF suspicious_activity THEN
        PERFORM public.log_formula_access_enhanced(
            _user_id,
            _formula_id,
            'access_denied_suspicious',
            jsonb_build_object(
                'reason', 'suspicious_activity_detected',
                'timestamp', now()
            )
        );
        RETURN false;
    END IF;
    
    IF NOT is_business_hours THEN
        PERFORM public.log_formula_access_enhanced(
            _user_id,
            _formula_id,
            'access_denied_hours',
            jsonb_build_object(
                'reason', 'outside_business_hours',
                'current_hour_est', current_hour,
                'current_day', current_day,
                'timestamp', now()
            )
        );
        RETURN false;
    END IF;
    
    -- All checks passed for non-admin user
    RETURN true;
END;
$$;

-- Update get_accessible_formulas to give admins unrestricted access
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
RETURNS TABLE(id uuid, code text, name text, default_batch_size_kg numeric, recipe_json jsonb, active_ingredients_json jsonb, security_level text, classification_level text, version text, yield_uom text, notes text, product_code_line text, procedure_text text, status text, created_at timestamp with time zone, updated_at timestamp with time zone, last_accessed_at timestamp with time zone, access_count integer, requires_approval boolean, is_deleted boolean, average_piece_weight numeric, total_pieces integer, formula_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_hour integer;
    current_day integer;
    is_business_hours boolean := false;
    is_admin boolean := false;
BEGIN
    -- Check if user exists and is authenticated
    IF _user_id IS NULL THEN
        -- Log access attempt with null formula_id (list request)
        PERFORM public.log_formula_access_enhanced(
            _user_id,
            NULL, -- null formula_id for list requests
            'unauthorized_list_access',
            jsonb_build_object(
                'error', 'unauthenticated_user',
                'timestamp', now()
            )
        );
        RETURN;
    END IF;

    -- Check if user is admin
    SELECT has_role(_user_id, 'admin'::app_role) INTO is_admin;

    -- Calculate business hours (7 AM - 6 PM EST, Monday-Friday) for non-admin users
    current_hour := EXTRACT(hour FROM (now() AT TIME ZONE 'America/New_York'));
    current_day := EXTRACT(dow FROM (now() AT TIME ZONE 'America/New_York'));
    
    -- Business hours: Monday-Friday (1-5), 7 AM - 6 PM EST
    is_business_hours := (current_day BETWEEN 1 AND 5) AND (current_hour BETWEEN 7 AND 17);

    -- Log the formula list access attempt
    PERFORM public.log_formula_access_enhanced(
        _user_id,
        NULL, -- null formula_id for list requests
        'formula_list_requested',
        jsonb_build_object(
            'security_level', 'list_access',
            'is_admin', is_admin,
            'session_details', jsonb_build_object(
                'function', 'get_accessible_formulas',
                'business_hours', is_business_hours,
                'current_hour_est', current_hour,
                'current_day', current_day,
                'admin_unrestricted', is_admin
            )
        )
    );

    -- Return formulas based on user roles and security levels
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.default_batch_size_kg, f.recipe_json, f.active_ingredients_json,
        f.security_level, f.classification_level, f.version, f.yield_uom, f.notes,
        f.product_code_line, f.procedure_text, f.status, f.created_at, f.updated_at,
        f.last_accessed_at, f.access_count, f.requires_approval, f.is_deleted,
        f.average_piece_weight, f.total_pieces, f.formula_code
    FROM public.formulas f
    WHERE 
        f.is_deleted = false
        AND (
            -- ADMINS GET UNRESTRICTED ACCESS TO ALL FORMULAS AT ANY TIME
            is_admin OR
            -- Standard formulas: accessible to rd_manager, production_manager (non-admin)
            (f.security_level = 'standard' AND (
                has_role(_user_id, 'rd_manager'::app_role) OR
                has_role(_user_id, 'production_manager'::app_role)
            )) OR
            -- Confidential formulas: accessible to rd_manager (non-admin)
            (f.security_level = 'confidential' AND 
                has_role(_user_id, 'rd_manager'::app_role)
            ) OR
            -- Trade secret formulas: only non-admin rd_manager during business hours
            (f.security_level = 'trade_secret' AND 
                has_role(_user_id, 'rd_manager'::app_role) AND 
                is_business_hours
            )
        )
    ORDER BY f.created_at DESC;
END;
$$;