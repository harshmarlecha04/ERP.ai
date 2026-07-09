-- Drop and recreate get_accessible_formulas with customer_id
DROP FUNCTION IF EXISTS public.get_accessible_formulas();

CREATE OR REPLACE FUNCTION public.get_accessible_formulas()
RETURNS TABLE (
    id uuid,
    code text,
    name text,
    formula_code text,
    product_code_line text,
    default_batch_size_kg numeric,
    average_piece_weight numeric,
    total_pieces integer,
    recipe_json jsonb,
    active_ingredients_json jsonb,
    procedure_text text,
    notes text,
    version text,
    yield_uom text,
    status text,
    security_level text,
    classification_level text,
    requires_approval boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    access_count integer,
    is_deleted boolean,
    customer_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.formula_code, f.product_code_line,
        f.default_batch_size_kg, f.average_piece_weight, f.total_pieces,
        f.recipe_json, f.active_ingredients_json, f.procedure_text,
        f.notes, f.version, f.yield_uom, f.status,
        f.security_level, f.classification_level, f.requires_approval,
        f.created_at, f.updated_at, f.last_accessed_at, f.access_count,
        f.is_deleted,
        f.customer_id
    FROM public.formulas f
    WHERE NOT f.is_deleted
    ORDER BY f.updated_at DESC;
END;
$function$;