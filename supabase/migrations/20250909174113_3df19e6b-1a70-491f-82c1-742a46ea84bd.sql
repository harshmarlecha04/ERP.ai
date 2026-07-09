-- Add vessel column to formula_ingredients table
ALTER TABLE public.formula_ingredients 
ADD COLUMN IF NOT EXISTS vessel TEXT CHECK (vessel IN ('cooker', 'holding')) NULL;

-- Update the save_formula_rpc function to handle vessel data in recipe_json
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='save_formula_rpc' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.save_formula_rpc(formula_data jsonb)
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

    -- Check if user has permission to create/update formulas
    IF NOT (has_role(user_id, 'admin'::app_role) OR 
            has_role(user_id, 'rd_manager'::app_role) OR 
            has_role(user_id, 'formulation_scientist'::app_role)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    -- Handle update if ID is provided
    IF formula_data ? 'id' AND (formula_data->>'id') != '' THEN
        -- Update existing formula
        UPDATE public.formulas SET
            code = formula_data->>'code',
            name = formula_data->>'name',
            default_batch_size_kg = COALESCE((formula_data->>'default_batch_size_kg')::numeric, default_batch_size_kg),
            recipe_json = COALESCE(formula_data->'recipe_json', recipe_json),
            active_ingredients_json = COALESCE(formula_data->'active_ingredients_json', active_ingredients_json),
            procedure_text = COALESCE(formula_data->>'procedure_text', procedure_text),
            classification_level = COALESCE(formula_data->>'classification_level', classification_level),
            security_level = COALESCE(formula_data->>'security_level', security_level),
            status = COALESCE(formula_data->>'status', status),
            product_code_line = COALESCE(formula_data->>'product_code_line', product_code_line),
            average_piece_weight = COALESCE((formula_data->>'average_piece_weight')::numeric, average_piece_weight),
            total_pieces = COALESCE((formula_data->>'total_pieces')::integer, total_pieces),
            yield_uom = COALESCE(formula_data->>'yield_uom', yield_uom),
            notes = formula_data->>'notes',
            updated_at = now()
        WHERE id = (formula_data->>'id')::uuid
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
            formula_data->>'code',
            formula_data->>'name',
            COALESCE((formula_data->>'default_batch_size_kg')::numeric, 150),
            COALESCE(formula_data->'recipe_json', '[]'::jsonb),
            COALESCE(formula_data->'active_ingredients_json', '[]'::jsonb),
            COALESCE(formula_data->>'procedure_text', ''),
            COALESCE(formula_data->>'classification_level', 'internal'),
            COALESCE(formula_data->>'security_level', 'standard'),
            COALESCE(formula_data->>'status', 'draft'),
            COALESCE(formula_data->>'product_code_line', '4'),
            COALESCE((formula_data->>'average_piece_weight')::numeric, 3.5),
            COALESCE((formula_data->>'total_pieces')::integer, 42857),
            COALESCE(formula_data->>'yield_uom', 'kg'),
            formula_data->>'notes',
            '1.0',
            false,
            false,
            1,
            now(),
            now()
        ) RETURNING id INTO result_id;
    END IF;

    -- Log the access (but avoid conflicts during creation)
    BEGIN
        PERFORM log_formula_access(
            user_id, 
            result_id, 
            CASE WHEN formula_data ? 'id' THEN 'update' ELSE 'create' END,
            jsonb_build_object(
                'operation', CASE WHEN formula_data ? 'id' THEN 'update' ELSE 'create' END,
                'formula_code', formula_data->>'code'
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Ignore logging errors to avoid blocking the main operation
        NULL;
    END;

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