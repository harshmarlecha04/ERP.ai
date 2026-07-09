-- Fix critical security vulnerability: Remove broad business hours access to formulas
-- This addresses the issue where any authenticated user could access standard formulas during business hours

-- Drop the vulnerable RLS policy
DROP POLICY IF EXISTS "secure_formula_access_policy" ON public.formulas;

-- Create new strict access policy with no business hours exception for unauthorized users
CREATE POLICY "strict_formula_access_policy" ON public.formulas
FOR SELECT TO authenticated
USING (
    (NOT is_deleted) AND (
        -- Trade secrets: Only admin and R&D managers
        (security_level = 'trade_secret' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role)
        )) OR
        -- Confidential: Admin, R&D managers, and production managers only
        (security_level = 'confidential' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role) OR 
            has_role(auth.uid(), 'production_manager'::app_role)
        )) OR
        -- Standard: Only authorized roles, NO broad business hours access
        (security_level = 'standard' AND (
            has_role(auth.uid(), 'admin'::app_role) OR 
            has_role(auth.uid(), 'rd_manager'::app_role) OR 
            has_role(auth.uid(), 'production_manager'::app_role)
        ))
    )
);

-- Update the get_accessible_formulas function to enforce strict access
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
    id uuid, code text, name text, default_batch_size_kg numeric,
    recipe_json jsonb, active_ingredients_json jsonb, security_level text,
    classification_level text, version text, yield_uom text, notes text,
    product_code_line text, procedure_text text, status text,
    created_at timestamp with time zone, updated_at timestamp with time zone,
    last_accessed_at timestamp with time zone, access_count integer,
    requires_approval boolean, is_deleted boolean, average_piece_weight numeric,
    total_pieces integer, formula_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    user_role text;
    is_admin boolean := false;
    is_rd_manager boolean := false;
    is_production_manager boolean := false;
BEGIN
    -- Strict authentication check
    IF _user_id IS NULL THEN
        PERFORM public.log_formula_access_enhanced(
            _user_id, NULL, 'unauthorized_access_attempt',
            jsonb_build_object('error', 'no_user_id', 'timestamp', now())
        );
        RETURN;
    END IF;

    -- Get user role information
    SELECT ur.role INTO user_role
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id;

    -- Set role flags
    is_admin := (user_role = 'admin');
    is_rd_manager := (user_role = 'rd_manager');
    is_production_manager := (user_role = 'production_manager');

    -- Log access attempt with role information
    PERFORM public.log_formula_access_enhanced(
        _user_id, NULL, 'formula_list_access',
        jsonb_build_object(
            'user_role', user_role,
            'access_type', 'strict_role_based',
            'business_hours_ignored', true,
            'timestamp', now()
        )
    );

    -- Return formulas with strict role-based access control
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.default_batch_size_kg,
        f.recipe_json, f.active_ingredients_json, f.security_level,
        f.classification_level, f.version, f.yield_uom, f.notes,
        f.product_code_line, f.procedure_text, f.status,
        f.created_at, f.updated_at, f.last_accessed_at,
        f.access_count, f.requires_approval, f.is_deleted,
        f.average_piece_weight, f.total_pieces, f.formula_code
    FROM public.formulas f
    WHERE (NOT f.is_deleted) AND (
        CASE 
            WHEN f.security_level = 'trade_secret' THEN
                (is_admin OR is_rd_manager)
            WHEN f.security_level = 'confidential' THEN
                (is_admin OR is_rd_manager OR is_production_manager)
            WHEN f.security_level = 'standard' THEN
                (is_admin OR is_rd_manager OR is_production_manager)
            ELSE false
        END
    )
    ORDER BY f.code;

    -- Update access tracking for successful access
    UPDATE public.formulas 
    SET 
        access_count = COALESCE(access_count, 0) + 1,
        last_accessed_at = now()
    WHERE id IN (
        SELECT f.id FROM public.formulas f
        WHERE (NOT f.is_deleted) AND (
            CASE 
                WHEN f.security_level = 'trade_secret' THEN
                    (is_admin OR is_rd_manager)
                WHEN f.security_level = 'confidential' THEN
                    (is_admin OR is_rd_manager OR is_production_manager)
                WHEN f.security_level = 'standard' THEN
                    (is_admin OR is_rd_manager OR is_production_manager)
                ELSE false
            END
        )
    );
END;
$$;

-- Create function to validate individual formula access with strict controls
CREATE OR REPLACE FUNCTION public.validate_formula_access_strict(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'view')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    formula_security_level text;
    user_role text;
    access_granted boolean := false;
BEGIN
    -- Get formula security level
    SELECT security_level INTO formula_security_level
    FROM public.formulas
    WHERE id = _formula_id AND NOT is_deleted;

    IF formula_security_level IS NULL THEN
        RETURN false;
    END IF;

    -- Get user role
    SELECT role INTO user_role
    FROM public.user_roles
    WHERE user_id = _user_id;

    -- Apply strict role-based access control
    access_granted := CASE 
        WHEN formula_security_level = 'trade_secret' THEN
            (user_role IN ('admin', 'rd_manager'))
        WHEN formula_security_level = 'confidential' THEN
            (user_role IN ('admin', 'rd_manager', 'production_manager'))
        WHEN formula_security_level = 'standard' THEN
            (user_role IN ('admin', 'rd_manager', 'production_manager'))
        ELSE false
    END;

    -- Log the access attempt
    PERFORM public.log_formula_access_enhanced(
        _user_id, _formula_id, _access_type,
        jsonb_build_object(
            'security_level', formula_security_level,
            'user_role', user_role,
            'access_granted', access_granted,
            'access_control', 'strict_role_based',
            'business_hours_ignored', true,
            'timestamp', now()
        )
    );

    RETURN access_granted;
END;
$$;

-- Create a function to check if emergency lockdown is active
CREATE OR REPLACE FUNCTION public.is_emergency_lockdown_active()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.security_config
        WHERE config_key = 'emergency_formula_lockdown'
        AND (config_value->>'active')::boolean = true
        AND (config_value->>'expires_at')::timestamp > now()
    );
END;
$$;

-- Add a security alert for this critical fix
INSERT INTO public.security_alerts (alert_type, severity, details)
VALUES (
    'formula_access_vulnerability_fixed',
    'critical',
    jsonb_build_object(
        'vulnerability', 'broad_business_hours_access',
        'fix_applied', true,
        'description', 'Removed dangerous business hours exception that allowed any authenticated user to access standard formulas during business hours',
        'new_policy', 'strict_role_based_access_only',
        'affected_security_levels', ARRAY['standard', 'confidential', 'trade_secret'],
        'timestamp', now()
    )
);