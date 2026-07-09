-- Fix the batch calculation function with proper logic
CREATE OR REPLACE FUNCTION public.calculate_max_batches(p_formula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req record;
  v_available numeric;
  v_required_per_batch numeric;
  v_max_from_ingredient numeric;
  v_overall_max numeric := 999999; -- Start with a very high number
  v_limiting_ingredient jsonb := null;
  v_result jsonb;
  v_ingredient_details jsonb := '[]'::jsonb;
  v_formula_exists boolean := false;
  v_recipe_json jsonb;
BEGIN
  -- Get formula recipe
  SELECT recipe_json INTO v_recipe_json
  FROM public.formulas 
  WHERE id = p_formula_id AND NOT is_deleted;
  
  IF v_recipe_json IS NULL THEN
    RETURN jsonb_build_object(
      'max_batches', 0,
      'limiting_ingredient', null,
      'ingredient_details', '[]'::jsonb,
      'has_sufficient_inventory', false
    );
  END IF;
  
  -- Loop through formula ingredients directly from JSON
  FOR req IN
    SELECT 
      rm.id as ingredient_id,
      rm.name as ingredient_name,
      COALESCE((recipe_item->>'weightKg')::numeric, (recipe_item->>'qty_per_batch_kg')::numeric, 0) as required_kg
    FROM jsonb_array_elements(v_recipe_json) as recipe_item
    JOIN public.raw_materials rm ON rm.name = (recipe_item->>'materialName')
    WHERE (recipe_item->>'materialName') IS NOT NULL
      AND COALESCE((recipe_item->>'weightKg')::numeric, (recipe_item->>'qty_per_batch_kg')::numeric, 0) > 0
  LOOP
    -- Get available inventory for this ingredient (sum of all lots minus reserved)
    SELECT COALESCE(SUM(l.quantity - COALESCE(l.qty_reserved_kg, 0)), 0) INTO v_available
    FROM public.raw_material_lots l
    WHERE l.raw_material_id = req.ingredient_id;
    
    v_required_per_batch := req.required_kg;
    
    -- Calculate max batches this ingredient can support
    IF v_required_per_batch > 0 THEN
      v_max_from_ingredient := FLOOR(v_available / v_required_per_batch);
    ELSE
      v_max_from_ingredient := 0;
    END IF;
    
    -- Track ingredient details
    v_ingredient_details := v_ingredient_details || jsonb_build_array(
      jsonb_build_object(
        'ingredient_id', req.ingredient_id,
        'ingredient_name', req.ingredient_name,
        'available_kg', v_available,
        'required_per_batch_kg', v_required_per_batch,
        'max_batches_from_ingredient', v_max_from_ingredient
      )
    );
    
    -- Update overall max if this ingredient is more limiting
    IF v_max_from_ingredient < v_overall_max THEN
      v_overall_max := v_max_from_ingredient;
      v_limiting_ingredient := jsonb_build_object(
        'ingredient_id', req.ingredient_id,
        'ingredient_name', req.ingredient_name,
        'available_kg', v_available,
        'required_per_batch_kg', v_required_per_batch,
        'max_batches', v_max_from_ingredient
      );
    END IF;
  END LOOP;
  
  -- If no ingredients found, max batches is 0
  IF v_overall_max = 999999 THEN
    v_overall_max := 0;
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'max_batches', v_overall_max,
    'limiting_ingredient', v_limiting_ingredient,
    'ingredient_details', v_ingredient_details,
    'has_sufficient_inventory', (v_overall_max > 0)
  );
  
  RETURN v_result;
END;
$function$;