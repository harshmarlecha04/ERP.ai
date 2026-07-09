DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='fn_move_item_and_recheck' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.fn_move_item_and_recheck(p_schedule_item_id uuid, p_new_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_formula_exists boolean;
  v_check jsonb;
  v_ok boolean;
  v_sched_id uuid;
  v_result jsonb;
BEGIN
  -- Load the schedule item directly (no inner join), so orphaned items still load.
  SELECT * FROM public.production_schedule_items
  WHERE id = p_schedule_item_id
  INTO v_item;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Schedule item not found');
  END IF;

  -- If formula_id is NULL, just move the date — nothing to check.
  IF v_item.formula_id IS NULL THEN
    v_sched_id := public.fn_upsert_schedule(p_new_date);
    UPDATE public.production_schedule_items
      SET schedule_id = v_sched_id
      WHERE id = p_schedule_item_id;
    RETURN jsonb_build_object('ok', true, 'schedule_id', v_sched_id, 'message', 'Moved (no linked formula — material check skipped)');
  END IF;

  -- Verify the linked formula still exists.
  SELECT EXISTS(SELECT 1 FROM public.formulas WHERE id = v_item.formula_id) INTO v_formula_exists;

  IF NOT v_formula_exists THEN
    -- Move anyway but warn — the formula is gone so we can't check materials.
    v_sched_id := public.fn_upsert_schedule(p_new_date);
    UPDATE public.production_schedule_items
      SET schedule_id = v_sched_id
      WHERE id = p_schedule_item_id;
    RETURN jsonb_build_object('ok', true, 'schedule_id', v_sched_id, 'message', 'Moved. Note: linked formula no longer exists — please delete or relink this item.');
  END IF;

  -- Normal path: check materials.
  v_check := public.fn_check_materials(v_item.formula_id, v_item.batches, p_new_date, p_schedule_item_id);
  v_ok := COALESCE((v_check->>'materials_ok')::boolean, false);

  IF v_ok THEN
    v_sched_id := public.fn_upsert_schedule(p_new_date);
    UPDATE public.production_schedule_items
      SET schedule_id = v_sched_id
      WHERE id = p_schedule_item_id;
    v_result := jsonb_build_object('ok', true, 'schedule_id', v_sched_id);
  ELSE
    v_result := jsonb_build_object('ok', false, 'message', 'Material shortages prevent moving to this date', 'shortages', v_check->'shortages');
  END IF;

  RETURN v_result;
END;
$function$;