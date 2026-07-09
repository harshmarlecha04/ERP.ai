-- Fix conflicting get_accessible_formulas functions
-- First drop all versions of the function
DROP FUNCTION IF EXISTS public.get_accessible_formulas();
DROP FUNCTION IF EXISTS public.get_accessible_formulas(uuid);

-- Recreate the secure version with proper return type
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
RETURNS TABLE(
    id uuid,
    code text,
    name text,
    default_batch_size_kg numeric,
    recipe_json jsonb,
    active_ingredients_json jsonb,
    procedure_text text,
    security_level text,
    classification_level text,
    version text,
    yield_uom text,
    notes text,
    product_code_line text,
    status text,
    requires_approval boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    access_count integer,
    average_piece_weight numeric,
    total_pieces integer,
    is_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- For admin users, return all non-deleted formulas
    IF has_role(_user_id, 'admin'::app_role) THEN
        RETURN QUERY
        SELECT 
            f.id, f.code, f.name, f.default_batch_size_kg, f.recipe_json,
            f.active_ingredients_json, f.procedure_text, f.security_level,
            f.classification_level, f.version, f.yield_uom, f.notes,
            f.product_code_line, f.status, f.requires_approval,
            f.created_at, f.updated_at, f.last_accessed_at, f.access_count,
            f.average_piece_weight, f.total_pieces, f.is_deleted
        FROM public.formulas f
        WHERE NOT COALESCE(f.is_deleted, false)
        ORDER BY f.created_at DESC;
        RETURN;
    END IF;
    
    -- For R&D managers, return all non-deleted formulas
    IF has_role(_user_id, 'rd_manager'::app_role) THEN
        RETURN QUERY
        SELECT 
            f.id, f.code, f.name, f.default_batch_size_kg, f.recipe_json,
            f.active_ingredients_json, f.procedure_text, f.security_level,
            f.classification_level, f.version, f.yield_uom, f.notes,
            f.product_code_line, f.status, f.requires_approval,
            f.created_at, f.updated_at, f.last_accessed_at, f.access_count,
            f.average_piece_weight, f.total_pieces, f.is_deleted
        FROM public.formulas f
        WHERE NOT COALESCE(f.is_deleted, false)
        ORDER BY f.created_at DESC;
        RETURN;
    END IF;
    
    -- For production managers, return standard and confidential formulas
    IF has_role(_user_id, 'production_manager'::app_role) THEN
        RETURN QUERY
        SELECT 
            f.id, f.code, f.name, f.default_batch_size_kg, f.recipe_json,
            f.active_ingredients_json, f.procedure_text, f.security_level,
            f.classification_level, f.version, f.yield_uom, f.notes,
            f.product_code_line, f.status, f.requires_approval,
            f.created_at, f.updated_at, f.last_accessed_at, f.access_count,
            f.average_piece_weight, f.total_pieces, f.is_deleted
        FROM public.formulas f
        WHERE NOT COALESCE(f.is_deleted, false)
        AND COALESCE(f.security_level, 'standard') IN ('standard', 'confidential')
        ORDER BY f.created_at DESC;
        RETURN;
    END IF;
    
    -- For other authenticated users, return only standard formulas with explicit permissions
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.default_batch_size_kg, f.recipe_json,
        f.active_ingredients_json, f.procedure_text, f.security_level,
        f.classification_level, f.version, f.yield_uom, f.notes,
        f.product_code_line, f.status, f.requires_approval,
        f.created_at, f.updated_at, f.last_accessed_at, f.access_count,
        f.average_piece_weight, f.total_pieces, f.is_deleted
    FROM public.formulas f
    LEFT JOIN public.formula_user_permissions fup ON fup.formula_id = f.id AND fup.user_id = _user_id
    WHERE NOT COALESCE(f.is_deleted, false)
    AND (
        COALESCE(f.security_level, 'standard') = 'standard'
        OR (
            fup.is_active = true 
            AND (fup.expires_at IS NULL OR fup.expires_at > now())
        )
    )
    ORDER BY f.created_at DESC;
END;
$$;