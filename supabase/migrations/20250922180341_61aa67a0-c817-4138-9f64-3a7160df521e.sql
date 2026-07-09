-- Create a simpler debug version of the batch calculation function
CREATE OR REPLACE FUNCTION public.calculate_max_batches_debug(p_formula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_formula_exists boolean := false;
  v_recipe_json jsonb;
  v_result jsonb;
  v_ingredient_count integer := 0;
  v_materials_found integer := 0;
  v_debug_info jsonb := '[]'::jsonb;
BEGIN
  -- Check if formula exists
  SELECT true, recipe_json INTO v_formula_exists, v_recipe_json
  FROM public.formulas 
  WHERE id = p_formula_id;
  
  IF NOT v_formula_exists THEN
    RETURN jsonb_build_object(
      'max_batches', 0,
      'error', 'Formula not found',
      'formula_id', p_formula_id
    );
  END IF;
  
  -- Count ingredients in recipe
  SELECT jsonb_array_length(COALESCE(v_recipe_json, '[]'::jsonb)) INTO v_ingredient_count;
  
  -- Check how many raw materials match the formula ingredients
  SELECT COUNT(*) INTO v_materials_found
  FROM (
    SELECT materialName
    FROM jsonb_to_recordset(COALESCE(v_recipe_json, '[]'::jsonb)) 
    AS x(materialName text, weightKg numeric)
    WHERE materialName IS NOT NULL
  ) recipe_ingredients
  JOIN public.raw_materials rm ON LOWER(rm.name) = LOWER(recipe_ingredients.materialName);
  
  -- Build debug result
  v_result := jsonb_build_object(
    'max_batches', 0,
    'debug_info', jsonb_build_object(
      'formula_exists', v_formula_exists,
      'ingredient_count', v_ingredient_count,
      'materials_found', v_materials_found,
      'recipe_json_sample', CASE 
        WHEN v_recipe_json IS NOT NULL AND jsonb_array_length(v_recipe_json) > 0 
        THEN v_recipe_json -> 0 
        ELSE null 
      END
    )
  );
  
  RETURN v_result;
END;
$function$;