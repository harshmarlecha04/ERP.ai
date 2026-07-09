-- Fix fn_formula_requirements to properly extract materials from recipe_json
CREATE OR REPLACE FUNCTION public.fn_formula_requirements(p_formula_id uuid, p_batches integer)
 RETURNS TABLE(ingredient_id uuid, ingredient_name text, required_kg numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    rm.id as ingredient_id,
    rm.name as ingredient_name,
    (rec.qty_per_batch_kg::numeric * p_batches)::numeric as required_kg
  FROM (
    SELECT * FROM jsonb_to_recordset(
      COALESCE((SELECT recipe_json FROM public.formulas f WHERE f.id = p_formula_id), '[]'::jsonb)
    ) AS x(materialName text, qty_per_batch_kg numeric)
  ) rec
  JOIN public.raw_materials rm ON LOWER(rm.name) = LOWER(rec.materialName)
  WHERE rec.materialName IS NOT NULL 
    AND rec.qty_per_batch_kg IS NOT NULL 
    AND rec.qty_per_batch_kg > 0;
END;
$function$;

-- Update fn_check_materials to work with the corrected fn_formula_requirements
CREATE OR REPLACE FUNCTION public.fn_check_materials(p_formula_id uuid, p_batches integer, p_schedule_date date, p_exclude_schedule_item_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shortages jsonb := '[]'::jsonb;
  v_ok boolean := true;
  req record;
  v_available numeric;
  v_scheduled numeric;
  v_result jsonb;
BEGIN
  FOR req IN SELECT * FROM public.fn_formula_requirements(p_formula_id, p_batches) LOOP
    -- Calculate available inventory (total quantity minus reserved)
    SELECT COALESCE(sum(l.quantity - COALESCE(l.qty_reserved_kg, 0)), 0) INTO v_available
    FROM public.raw_material_lots l
    WHERE l.raw_material_id = req.ingredient_id;

    -- Calculate already scheduled quantities for the same date
    SELECT COALESCE(sum(usage.actual_quantity_kg), 0) INTO v_scheduled
    FROM public.production_ingredient_usage usage
    JOIN public.production_schedule_items psi ON psi.id = usage.schedule_item_id
    JOIN public.production_schedules ps ON ps.id = psi.schedule_id
    WHERE ps.schedule_date = p_schedule_date
      AND usage.raw_material_id = req.ingredient_id
      AND COALESCE(psi.materials_ok, false) = true
      AND COALESCE(ps.status, 'scheduled') <> 'completed'
      AND (p_exclude_schedule_item_id IS NULL OR psi.id <> p_exclude_schedule_item_id);

    -- Subtract scheduled quantities from available
    v_available := v_available - v_scheduled;

    -- Check if there's enough material
    IF req.required_kg > v_available THEN
      v_ok := false;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_id', req.ingredient_id,
        'ingredient_name', req.ingredient_name,
        'required_kg', req.required_kg,
        'available_kg', GREATEST(v_available, 0),
        'shortfall_kg', GREATEST(req.required_kg - GREATEST(v_available, 0), 0)
      ));
    END IF;
  END LOOP;

  v_result := jsonb_build_object('materials_ok', v_ok, 'shortages', v_shortages);
  RETURN v_result;
END;
$function$;