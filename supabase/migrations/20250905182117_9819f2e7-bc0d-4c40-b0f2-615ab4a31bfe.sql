-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_accessible_formulas(uuid);

-- Create function to get accessible formulas based on user permissions and security level
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
 RETURNS TABLE(
    id uuid,
    code text,
    name text,
    product_code_line text,
    default_batch_size_kg numeric,
    average_piece_weight numeric,
    total_pieces integer,
    procedure_text text,
    active_ingredients_json jsonb,
    recipe_json jsonb,
    version text,
    yield_uom text,
    notes text,
    status text,
    security_level text,
    classification_level text,
    requires_session boolean,
    is_deleted boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Check if user is authenticated
    IF _user_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Return all non-deleted formulas that the user can access based on security policies
    RETURN QUERY
    SELECT 
        f.id,
        f.code,
        f.name,
        f.product_code_line,
        f.default_batch_size_kg,
        f.average_piece_weight,
        f.total_pieces,
        f.procedure_text,
        f.active_ingredients_json,
        f.recipe_json,
        f.version,
        f.yield_uom,
        f.notes,
        f.status,
        f.security_level,
        f.classification_level,
        f.requires_approval as requires_session,
        f.is_deleted,
        f.created_at,
        f.updated_at
    FROM public.formulas f
    WHERE f.is_deleted = false
    AND (
        -- Admin users can see all formulas
        has_role(_user_id, 'admin'::app_role) OR
        -- R&D managers can see standard and confidential formulas
        (has_role(_user_id, 'rd_manager'::app_role) AND f.security_level IN ('standard', 'confidential')) OR
        -- Production managers can see standard formulas
        (has_role(_user_id, 'production_manager'::app_role) AND f.security_level = 'standard') OR
        -- Users with explicit permissions can see specific formulas
        EXISTS (
            SELECT 1 FROM public.formula_user_permissions fup
            WHERE fup.formula_id = f.id 
            AND fup.user_id = _user_id 
            AND fup.is_active = true
            AND (fup.expires_at IS NULL OR fup.expires_at > now())
        )
    )
    ORDER BY f.created_at DESC;
END;
$function$;