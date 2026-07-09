-- CRITICAL SECURITY FIX: Remove dangerous business hours formula access
-- Replace the existing formula RLS policy with strict security controls

-- First, drop the existing policy that may allow broad business hours access
DO $pol$ BEGIN DROP POLICY IF EXISTS "business_hours_formula_access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Business hours enhanced formula access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Unrestricted admin formula access v2" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new SECURE formula access policy with NO business hours exceptions for sensitive data
DO $pol$ BEGIN DROP POLICY IF EXISTS "secure_formula_access_policy" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "secure_formula_access_policy" 
ON public.formulas 
FOR SELECT 
USING (
    (NOT is_deleted) AND 
    (
        -- CRITICAL: Trade secrets NEVER get business hours access - only R&D and admins
        (security_level = 'trade_secret' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role)
        )) OR
        
        -- Confidential: Restricted to R&D personnel and production managers
        (security_level = 'confidential' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role) OR
            has_role(auth.uid(), 'production_manager'::app_role)
        )) OR
        
        -- Standard formulas: Business hours OR authorized roles
        (security_level = 'standard' AND (
            (public.is_business_hours() AND auth.uid() IS NOT NULL) OR
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role) OR 
            has_role(auth.uid(), 'production_manager'::app_role)
        ))
    )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create additional security function to validate formula access attempts
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_access_attempt' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_formula_access_attempt(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'read')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_security text;
    formula_classification text;
    user_role_name text;
    access_granted boolean := false;
    is_business_time boolean;
BEGIN
    -- Get formula details
    SELECT security_level, classification_level 
    INTO formula_security, formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- Get user role
    SELECT role INTO user_role_name
    FROM public.user_roles 
    WHERE user_id = _user_id;
    
    -- Check business hours
    is_business_time := public.is_business_hours();
    
    -- Apply strict access controls
    CASE 
        WHEN formula_security = 'trade_secret' THEN
            -- Trade secrets: Only admins and R&D managers, NO business hours exception
            access_granted := (user_role_name IN ('admin', 'rd_manager'));
            
        WHEN formula_security = 'confidential' THEN
            -- Confidential: Authorized roles only, NO blanket business hours access
            access_granted := (user_role_name IN ('admin', 'rd_manager', 'production_manager'));
            
        WHEN formula_security = 'standard' THEN
            -- Standard: Business hours OR authorized roles
            access_granted := (
                (is_business_time AND _user_id IS NOT NULL) OR
                (user_role_name IN ('admin', 'rd_manager', 'production_manager'))
            );
            
        ELSE
            access_granted := false;
    END CASE;
    
    -- Log ALL formula access attempts for security monitoring
    INSERT INTO public.formula_access_audit (
        user_id, formula_id, access_type, details
    ) VALUES (
        _user_id, _formula_id, 
        CASE WHEN access_granted THEN 'authorized_access' ELSE 'access_denied' END,
        jsonb_build_object(
            'security_level', formula_security,
            'classification', formula_classification,
            'user_role', user_role_name,
            'business_hours', is_business_time,
            'requested_access', _access_type,
            'ip_address', inet_client_addr(),
            'timestamp', now()
        )
    );
    
    -- If access denied, create security alert
    IF NOT access_granted THEN
        INSERT INTO public.security_alerts (
            alert_type, severity, details
        ) VALUES (
            'unauthorized_formula_access_attempt',
            'high',
            jsonb_build_object(
                'user_id', _user_id,
                'formula_id', _formula_id,
                'security_level', formula_security,
                'user_role', user_role_name,
                'attempted_at', now(),
                'reason', 'insufficient_privileges'
            )
        );
    END IF;
    
    RETURN access_granted;
END;
$$;

-- Update the get_accessible_formulas function with enhanced security
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_accessible_formulas' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_accessible_formulas()
RETURNS TABLE(
    id uuid, code text, name text, formula_code text, 
    classification_level text, version text, yield_uom text,
    notes text, product_code_line text, procedure_text text,
    status text, security_level text, default_batch_size_kg numeric,
    created_at timestamptz, updated_at timestamptz, recipe_json jsonb,
    is_deleted boolean, average_piece_weight numeric, total_pieces integer,
    active_ingredients_json jsonb, requires_approval boolean,
    last_accessed_at timestamptz, access_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id uuid := auth.uid();
    user_role_name text;
    is_business_time boolean;
BEGIN
    -- Validate user is authenticated
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;
    
    -- Get user role
    SELECT role INTO user_role_name
    FROM public.user_roles 
    WHERE user_id = user_id;
    
    -- Check business hours
    is_business_time := public.is_business_hours();
    
    -- Log the access attempt
    INSERT INTO public.formula_access_audit (
        user_id, formula_id, access_type, details
    ) VALUES (
        user_id, NULL, 'formula_list_access',
        jsonb_build_object(
            'user_role', user_role_name,
            'business_hours', is_business_time,
            'timestamp', now()
        )
    );
    
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.formula_code,
        f.classification_level, f.version, f.yield_uom,
        f.notes, f.product_code_line, f.procedure_text,
        f.status, f.security_level, f.default_batch_size_kg,
        f.created_at, f.updated_at, f.recipe_json,
        f.is_deleted, f.average_piece_weight, f.total_pieces,
        f.active_ingredients_json, f.requires_approval,
        f.last_accessed_at, f.access_count
    FROM public.formulas f
    WHERE (NOT f.is_deleted) AND 
    (
        -- STRICT SECURITY: No broad business hours access to sensitive formulas
        CASE 
            WHEN f.security_level = 'trade_secret' THEN
                (user_role_name IN ('admin', 'rd_manager'))
            WHEN f.security_level = 'confidential' THEN
                (user_role_name IN ('admin', 'rd_manager', 'production_manager'))
            WHEN f.security_level = 'standard' THEN
                ((is_business_time AND user_id IS NOT NULL) OR 
                 (user_role_name IN ('admin', 'rd_manager', 'production_manager')))
            ELSE false
        END
    )
    ORDER BY f.code;
END;
$$;

-- Create emergency formula access lockdown function (admin only)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='emergency_formula_lockdown' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.emergency_formula_lockdown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can trigger emergency lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Temporarily disable business hours access to ALL formulas
    INSERT INTO public.security_config (config_key, config_value) 
    VALUES ('emergency_formula_lockdown', jsonb_build_object(
        'enabled', true,
        'activated_by', auth.uid(),
        'activated_at', now(),
        'reason', 'security_incident'
    ))
    ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        updated_at = now();
        
    -- Log the emergency action
    INSERT INTO public.security_alerts (
        alert_type, severity, details  
    ) VALUES (
        'emergency_formula_lockdown',
        'critical',
        jsonb_build_object(
            'activated_by', auth.uid(),
            'timestamp', now(),
            'action', 'all_formula_access_restricted'
        )
    );
END;
$$;