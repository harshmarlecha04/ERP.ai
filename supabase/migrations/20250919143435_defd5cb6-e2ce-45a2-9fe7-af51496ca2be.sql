-- Create the missing save_formula function
CREATE OR REPLACE FUNCTION public.save_formula(
    p_formula_data jsonb,
    p_formula_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_formula_id uuid;
BEGIN
    -- Check user permissions
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
    
    -- If updating existing formula
    IF p_formula_id IS NOT NULL THEN
        UPDATE public.formulas 
        SET 
            code = p_formula_data->>'code',
            name = p_formula_data->>'name',
            product_code_line = p_formula_data->>'product_code_line',
            default_batch_size_kg = (p_formula_data->>'default_batch_size_kg')::numeric,
            average_piece_weight = (p_formula_data->>'average_piece_weight')::numeric,
            total_pieces = (p_formula_data->>'total_pieces')::integer,
            procedure_text = p_formula_data->>'procedure_text',
            active_ingredients_json = p_formula_data->'active_ingredients_json',
            recipe_json = p_formula_data->'recipe_json',
            version = p_formula_data->>'version',
            yield_uom = p_formula_data->>'yield_uom',
            status = p_formula_data->>'status',
            updated_at = now()
        WHERE id = p_formula_id;
        
        v_formula_id := p_formula_id;
    ELSE
        -- Create new formula
        INSERT INTO public.formulas (
            code, name, product_code_line, default_batch_size_kg, 
            average_piece_weight, total_pieces, procedure_text,
            active_ingredients_json, recipe_json, version, yield_uom, status
        ) VALUES (
            p_formula_data->>'code',
            p_formula_data->>'name',
            p_formula_data->>'product_code_line',
            (p_formula_data->>'default_batch_size_kg')::numeric,
            (p_formula_data->>'average_piece_weight')::numeric,
            (p_formula_data->>'total_pieces')::integer,
            p_formula_data->>'procedure_text',
            p_formula_data->'active_ingredients_json',
            p_formula_data->'recipe_json',
            p_formula_data->>'version',
            p_formula_data->>'yield_uom',
            p_formula_data->>'status'
        )
        RETURNING id INTO v_formula_id;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'formula_id', v_formula_id);
END;
$$;