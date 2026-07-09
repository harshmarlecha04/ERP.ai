-- Create comprehensive business hours validation function
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    current_time_est timestamptz;
    day_of_week integer;
    hour_of_day integer;
BEGIN
    -- Convert current UTC time to America/New_York timezone
    current_time_est := now() AT TIME ZONE 'America/New_York';
    
    -- Get day of week (1=Sunday, 2=Monday, ..., 7=Saturday)
    day_of_week := EXTRACT(DOW FROM current_time_est);
    
    -- Get hour of day (0-23)
    hour_of_day := EXTRACT(HOUR FROM current_time_est);
    
    -- Check if it's Monday-Friday (2-6) and between 7 AM and 7 PM
    RETURN (day_of_week BETWEEN 2 AND 6) AND (hour_of_day BETWEEN 7 AND 18);
END;
$$;

-- Enhanced function to check if user has access during business hours
CREATE OR REPLACE FUNCTION public.has_business_hours_access(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- During business hours, all authenticated users have full access
    IF public.is_business_hours() AND _user_id IS NOT NULL THEN
        RETURN true;
    END IF;
    
    -- Outside business hours, only admins and production managers
    RETURN (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    );
END;
$$;

-- Update trade secret access validation to allow all users during business hours
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_enhanced(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_classification text;
    has_specific_access boolean := false;
    is_business_time boolean;
BEGIN
    -- Check if it's business hours
    is_business_time := public.is_business_hours();
    
    -- Get formula classification level
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- During business hours, all authenticated users can access trade secrets
    IF is_business_time AND _user_id IS NOT NULL THEN
        -- Log the business hours access
        PERFORM public.log_formula_access(_user_id, _formula_id, 'business_hours_access', 
            jsonb_build_object(
                'access_reason', 'business_hours_policy',
                'classification', formula_classification,
                'timestamp', now()
            )
        );
        RETURN true;
    END IF;
    
    -- Outside business hours, use existing role-based access
    IF formula_classification = 'trade_secret' THEN
        -- Check for explicit approval in access requests
        SELECT EXISTS (
            SELECT 1 FROM public.formula_access_requests far
            JOIN public.formula_access_permissions fap ON fap.user_id = far.user_id AND fap.formula_id = far.formula_id
            WHERE far.user_id = _user_id 
            AND far.formula_id = _formula_id
            AND far.status = 'approved'
            AND fap.is_active = true
            AND (fap.expires_at IS NULL OR fap.expires_at > now())
            AND (far.expires_at IS NULL OR far.expires_at > now())
        ) INTO has_specific_access;
        
        RETURN has_specific_access;
    END IF;
    
    -- For non-trade-secret formulas, allow access during business hours or for authorized roles
    RETURN public.has_business_hours_access(_user_id);
END;
$$;

-- Enhanced function to get formulas with business hours access
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
    is_business_time boolean;
BEGIN
    -- Check business hours
    is_business_time := public.is_business_hours();
    
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
        -- Business hours: all authenticated users can access all formulas
        (is_business_time AND user_id IS NOT NULL) OR
        -- Outside business hours: existing role-based access
        (has_role(user_id, 'admin'::app_role)) OR 
        ((f.security_level = 'standard') AND (has_role(user_id, 'rd_manager'::app_role) OR has_role(user_id, 'production_manager'::app_role))) OR 
        ((f.security_level = 'confidential') AND has_role(user_id, 'rd_manager'::app_role)) OR 
        ((f.security_level = 'trade_secret') AND validate_trade_secret_access_enhanced(user_id, f.id))
    )
    ORDER BY f.code;
END;
$$;