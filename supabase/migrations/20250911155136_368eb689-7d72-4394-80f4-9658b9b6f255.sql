-- SECURITY FIX: Restrict trade secret access even during business hours
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
    user_role_level text;
BEGIN
    -- Get formula classification level
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- CRITICAL SECURITY: Trade secrets NEVER get blanket business hours access
    IF formula_classification = 'trade_secret' THEN
        -- Trade secrets require explicit approval regardless of business hours
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
        
        -- Additional check: Only R&D managers and admins can access without explicit approval
        IF NOT has_specific_access THEN
            has_specific_access := (
                has_role(_user_id, 'admin'::app_role) OR 
                has_role(_user_id, 'rd_manager'::app_role)
            );
        END IF;
        
        -- Log ALL trade secret access attempts
        PERFORM public.log_formula_access(_user_id, _formula_id, 
            CASE WHEN has_specific_access THEN 'trade_secret_authorized_access' ELSE 'trade_secret_access_denied' END, 
            jsonb_build_object(
                'classification', formula_classification,
                'has_explicit_approval', (SELECT COUNT(*) FROM public.formula_access_permissions WHERE user_id = _user_id AND formula_id = _formula_id AND is_active = true),
                'user_role', (SELECT role FROM public.user_roles WHERE user_id = _user_id),
                'timestamp', now(),
                'security_level', 'critical'
            )
        );
        
        RETURN has_specific_access;
    END IF;
    
    -- Check if it's business hours for non-trade-secret formulas
    is_business_time := public.is_business_hours();
    
    -- For confidential formulas: Business hours OR authorized roles
    IF formula_classification = 'confidential' THEN
        IF is_business_time AND _user_id IS NOT NULL THEN
            -- Log business hours access to confidential formulas
            PERFORM public.log_formula_access(_user_id, _formula_id, 'confidential_business_hours_access', 
                jsonb_build_object(
                    'access_reason', 'business_hours_policy',
                    'classification', formula_classification,
                    'timestamp', now()
                )
            );
            RETURN true;
        END IF;
        
        -- Outside business hours: R&D managers only
        RETURN has_role(_user_id, 'admin'::app_role) OR has_role(_user_id, 'rd_manager'::app_role);
    END IF;
    
    -- For standard/internal formulas: Business hours OR authorized roles
    IF is_business_time AND _user_id IS NOT NULL THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'standard_business_hours_access', 
            jsonb_build_object(
                'access_reason', 'business_hours_policy',
                'classification', formula_classification,
                'timestamp', now()
            )
        );
        RETURN true;
    END IF;
    
    -- Outside business hours: Use existing role-based access
    RETURN public.has_business_hours_access(_user_id);
END;
$$;

-- Enhanced function to get formulas with proper trade secret protection
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
        -- SECURITY: Trade secrets have strict access controls regardless of business hours
        (f.security_level = 'trade_secret' AND validate_trade_secret_access_enhanced(user_id, f.id)) OR
        
        -- Confidential: Business hours for all users OR authorized roles
        (f.security_level = 'confidential' AND (
            (is_business_time AND user_id IS NOT NULL) OR
            has_role(user_id, 'admin'::app_role) OR 
            has_role(user_id, 'rd_manager'::app_role)
        )) OR
        
        -- Standard: Business hours for all users OR authorized roles  
        (f.security_level = 'standard' AND (
            (is_business_time AND user_id IS NOT NULL) OR
            has_role(user_id, 'admin'::app_role) OR 
            has_role(user_id, 'rd_manager'::app_role) OR 
            has_role(user_id, 'production_manager'::app_role)
        ))
    )
    ORDER BY f.code;
END;
$$;

-- Create audit function for trade secret access monitoring
CREATE OR REPLACE FUNCTION public.audit_trade_secret_access()
RETURNS TABLE(
    access_date date,
    user_email text,
    formula_code text,
    access_type text,
    risk_assessment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can view trade secret audit logs
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required for trade secret audit';
    END IF;
    
    RETURN QUERY
    SELECT 
        faa.accessed_at::date as access_date,
        COALESCE(p.email, 'Unknown User') as user_email,
        COALESCE(f.code, 'Unknown Formula') as formula_code,
        faa.access_type,
        CASE 
            WHEN faa.access_type LIKE '%denied%' THEN 'HIGH RISK - Unauthorized attempt'
            WHEN faa.access_type = 'trade_secret_authorized_access' THEN 'MONITORED - Authorized access'
            ELSE 'MEDIUM RISK - Review required'
        END as risk_assessment
    FROM public.formula_access_audit faa
    LEFT JOIN auth.users au ON au.id = faa.user_id
    LEFT JOIN public.profiles p ON p.id = faa.user_id
    LEFT JOIN public.formulas f ON f.id = faa.formula_id
    WHERE faa.access_type ILIKE '%trade_secret%'
    ORDER BY faa.accessed_at DESC
    LIMIT 100;
END;
$$;