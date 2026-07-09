-- Fix the save_formula function to use valid app_role enum values
CREATE OR REPLACE FUNCTION public.save_formula(p_formula_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result_id uuid;
    user_id uuid;
    formula_record record;
BEGIN
    -- Get the current user
    user_id := auth.uid();
    
    IF user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check if user has permission to create/update formulas (using valid roles)
    IF NOT (has_role(user_id, 'admin'::app_role) OR 
            has_role(user_id, 'user'::app_role)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    -- Handle update if ID is provided
    IF p_formula_data ? 'id' AND (p_formula_data->>'id') != '' AND (p_formula_data->>'id') != 'null' THEN
        -- Update existing formula
        UPDATE public.formulas SET
            code = p_formula_data->>'code',
            name = p_formula_data->>'name',
            default_batch_size_kg = COALESCE((p_formula_data->>'default_batch_size_kg')::numeric, default_batch_size_kg),
            recipe_json = COALESCE(p_formula_data->'recipe_json', recipe_json),
            active_ingredients_json = COALESCE(p_formula_data->'active_ingredients_json', active_ingredients_json),
            procedure_text = COALESCE(p_formula_data->>'procedure_text', procedure_text),
            classification_level = COALESCE(p_formula_data->>'classification_level', classification_level),
            security_level = COALESCE(p_formula_data->>'security_level', security_level),
            status = COALESCE(p_formula_data->>'status', status),
            product_code_line = COALESCE(p_formula_data->>'product_code_line', product_code_line),
            average_piece_weight = COALESCE((p_formula_data->>'average_piece_weight')::numeric, average_piece_weight),
            total_pieces = COALESCE((p_formula_data->>'total_pieces')::integer, total_pieces),
            yield_uom = COALESCE(p_formula_data->>'yield_uom', yield_uom),
            notes = p_formula_data->>'notes',
            updated_at = now()
        WHERE id = (p_formula_data->>'id')::uuid
        RETURNING id INTO result_id;
        
        IF result_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Formula not found or access denied');
        END IF;
    ELSE
        -- Insert new formula
        INSERT INTO public.formulas (
            code,
            name,
            default_batch_size_kg,
            recipe_json,
            active_ingredients_json,
            procedure_text,
            classification_level,
            security_level,
            status,
            product_code_line,
            average_piece_weight,
            total_pieces,
            yield_uom,
            notes,
            version,
            is_deleted,
            requires_approval,
            access_count,
            created_at,
            updated_at
        ) VALUES (
            p_formula_data->>'code',
            p_formula_data->>'name',
            COALESCE((p_formula_data->>'default_batch_size_kg')::numeric, 150),
            COALESCE(p_formula_data->'recipe_json', '[]'::jsonb),
            COALESCE(p_formula_data->'active_ingredients_json', '[]'::jsonb),
            COALESCE(p_formula_data->>'procedure_text', ''),
            COALESCE(p_formula_data->>'classification_level', 'internal'),
            COALESCE(p_formula_data->>'security_level', 'standard'),
            COALESCE(p_formula_data->>'status', 'draft'),
            COALESCE(p_formula_data->>'product_code_line', '4'),
            COALESCE((p_formula_data->>'average_piece_weight')::numeric, 3.5),
            COALESCE((p_formula_data->>'total_pieces')::integer, 42857),
            COALESCE(p_formula_data->>'yield_uom', 'kg'),
            p_formula_data->>'notes',
            '1.0',
            false,
            false,
            1,
            now(),
            now()
        ) RETURNING id INTO result_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'formula_id', result_id,
        'message', 'Formula saved successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM,
            'message', 'Failed to save formula'
        );
END;
$function$;