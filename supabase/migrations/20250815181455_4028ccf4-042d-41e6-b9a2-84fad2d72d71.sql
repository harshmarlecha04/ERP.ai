-- Fix fn_create_schedule_item to use the correct formula code field
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='fn_create_schedule_item' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.fn_create_schedule_item(p_schedule_date date, p_formula_id uuid, p_batches integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_check jsonb;
  v_sched_id uuid;
  v_item_id uuid;
  v_total_required numeric;
  v_formula_code text;
  v_res jsonb;
BEGIN
  v_check := public.fn_check_materials(p_formula_id, p_batches, p_schedule_date, null);
  IF COALESCE((v_check->>'materials_ok')::boolean, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'shortages', v_check->'shortages');
  END IF;

  v_sched_id := public.fn_upsert_schedule(p_schedule_date);

  -- Use the 'code' field instead of 'formula_code' since code is not nullable
  SELECT COALESCE(default_batch_size_kg, 0), code
  INTO v_total_required, v_formula_code
  FROM public.formulas WHERE id = p_formula_id;
  v_total_required := COALESCE(v_total_required, 0) * p_batches;

  INSERT INTO public.production_schedule_items(
    schedule_id, formula_id, formula_code, batches, total_required_kg, materials_ok, shortages_json
  ) VALUES (
    v_sched_id, p_formula_id, v_formula_code, p_batches, v_total_required, true, '[]'::jsonb
  ) RETURNING id INTO v_item_id;

  v_res := public.fn_reserve_materials(v_item_id);

  RETURN jsonb_build_object('ok', true, 'schedule_id', v_sched_id, 'item_id', v_item_id, 'reservations', v_res->'reservations');
END;
$function$;