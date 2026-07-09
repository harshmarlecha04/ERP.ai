-- Create RPC function for saving formulas with all related data
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='save_formula' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.save_formula(
  p_formula_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_formula_id uuid;
  v_existing_formula record;
  v_result jsonb;
BEGIN
  -- Log the input for debugging
  RAISE LOG 'save_formula called with data: %', p_formula_data;
  
  -- Extract formula ID if this is an update
  v_formula_id := (p_formula_data->>'id')::uuid;
  
  -- If we have an ID, this is an update
  IF v_formula_id IS NOT NULL THEN
    -- Update existing formula
    UPDATE public.formulas 
    SET 
      code = p_formula_data->>'code',
      product_code_line = p_formula_data->>'product_code_line',
      name = p_formula_data->>'name',
      default_batch_size_kg = (p_formula_data->>'default_batch_size_kg')::numeric,
      average_piece_weight = (p_formula_data->>'average_piece_weight')::numeric,
      total_pieces = (p_formula_data->>'total_pieces')::integer,
      active_ingredients_json = COALESCE(p_formula_data->'active_ingredients_json', '[]'::jsonb),
      recipe_json = COALESCE(p_formula_data->'recipe_json', '[]'::jsonb),
      procedure_text = p_formula_data->>'procedure_text',
      status = COALESCE(p_formula_data->>'status', 'active'),
      updated_at = now()
    WHERE id = v_formula_id
    RETURNING * INTO v_existing_formula;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Formula with ID % not found', v_formula_id;
    END IF;
    
    RAISE LOG 'Updated formula with ID: %', v_formula_id;
    
  ELSE
    -- Insert new formula
    INSERT INTO public.formulas (
      code,
      product_code_line,
      name,
      default_batch_size_kg,
      average_piece_weight,
      total_pieces,
      active_ingredients_json,
      recipe_json,
      procedure_text,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_formula_data->>'code',
      p_formula_data->>'product_code_line',
      p_formula_data->>'name',
      (p_formula_data->>'default_batch_size_kg')::numeric,
      (p_formula_data->>'average_piece_weight')::numeric,
      (p_formula_data->>'total_pieces')::integer,
      COALESCE(p_formula_data->'active_ingredients_json', '[]'::jsonb),
      COALESCE(p_formula_data->'recipe_json', '[]'::jsonb),
      p_formula_data->>'procedure_text',
      COALESCE(p_formula_data->>'status', 'active'),
      now(),
      now()
    ) RETURNING * INTO v_existing_formula;
    
    v_formula_id := v_existing_formula.id;
    RAISE LOG 'Created new formula with ID: %', v_formula_id;
  END IF;
  
  -- Log the audit entry
  PERFORM public.log_formula_access(
    auth.uid(), 
    v_formula_id, 
    CASE WHEN p_formula_data->>'id' IS NOT NULL THEN 'update' ELSE 'create' END,
    jsonb_build_object(
      'formula_code', v_existing_formula.code,
      'formula_name', v_existing_formula.name,
      'status', v_existing_formula.status
    )
  );
  
  -- Return the saved formula data
  v_result := jsonb_build_object(
    'success', true,
    'data', to_jsonb(v_existing_formula),
    'message', CASE 
      WHEN p_formula_data->>'id' IS NOT NULL THEN 'Formula updated successfully'
      ELSE 'Formula created successfully'
    END
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in save_formula: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to save formula'
    );
END;
$$;