-- Update fn_check_materials to return all ingredients with availability status
CREATE OR REPLACE FUNCTION public.fn_check_materials(
  p_formula_id uuid, 
  p_batches integer, 
  p_schedule_date date, 
  p_exclude_schedule_item_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_shortages jsonb := '[]'::jsonb;
  v_all_ingredients jsonb := '[]'::jsonb;
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

    -- Add to all_ingredients list
    v_all_ingredients := v_all_ingredients || jsonb_build_array(jsonb_build_object(
      'ingredient_id', req.ingredient_id,
      'ingredient_name', req.ingredient_name,
      'required_kg', req.required_kg,
      'available_kg', GREATEST(v_available, 0),
      'is_sufficient', (req.required_kg <= v_available)
    ));

    -- Check if there's enough material
    IF req.required_kg > v_available THEN
      v_ok := false;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_id', req.ingredient_id,
        'ingredient_name', req.ingredient_name,
        'required_kg', req.required_kg,
        'available_kg', GREATEST(v_available, 0),
        'shortfall_kg', req.required_kg - v_available
      ));
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'materials_ok', v_ok, 
    'shortages', v_shortages,
    'all_ingredients', v_all_ingredients
  );
  RETURN v_result;
END;
$function$;