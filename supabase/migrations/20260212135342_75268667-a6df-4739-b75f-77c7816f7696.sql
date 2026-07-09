
-- Fix convert_rd_to_production search_path
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='convert_rd_to_production' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.convert_rd_to_production(p_rd_project_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_formula_id UUID;
  v_project RECORD;
  v_actives JSONB;
BEGIN
  SELECT * INTO v_project FROM rd_projects WHERE id = p_rd_project_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'R&D Project not found';
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'active_name', active_name,
      'mg_per_gummy', mg_per_gummy
    ) ORDER BY sort_order
  ) INTO v_actives
  FROM rd_project_actives
  WHERE rd_project_id = p_rd_project_id;
  
  INSERT INTO formulas (
    code, name, customer_id, default_batch_size_kg,
    active_ingredients_json, status, notes
  ) VALUES (
    v_project.project_number || '-PROD',
    v_project.customer_name || ' - ' || v_project.flavor || ' - ' || v_project.color,
    v_project.customer_id, 0, v_actives, 'draft',
    'Converted from R&D Project: ' || v_project.project_number || E'\nFlavor: ' || v_project.flavor || E'\nColor: ' || v_project.color
  )
  RETURNING id INTO v_formula_id;
  
  UPDATE rd_projects
  SET status = 'converted_to_production',
      converted_to_formula_id = v_formula_id,
      converted_at = now()
  WHERE id = p_rd_project_id;
  
  RETURN v_formula_id;
END;
$function$;

-- Fix fn_create_schedule_item (3-arg overload) search_path
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='fn_create_schedule_item' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.fn_create_schedule_item(p_schedule_date date, p_formula_id uuid, p_batches integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_schedule_id uuid;
  v_formula_code text;
  v_materials_check jsonb;
  v_schedule_item_id uuid;
BEGIN
  SELECT code INTO v_formula_code
  FROM formulas
  WHERE id = p_formula_id;

  IF v_formula_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Formula not found');
  END IF;

  v_materials_check := fn_check_materials(p_formula_id, p_batches, p_schedule_date);
  
  SELECT id INTO v_schedule_id
  FROM production_schedules
  WHERE schedule_date = p_schedule_date;
  
  IF v_schedule_id IS NULL THEN
    INSERT INTO production_schedules (schedule_date, status, created_by)
    VALUES (p_schedule_date, 'scheduled', auth.uid())
    RETURNING id INTO v_schedule_id;
  END IF;
  
  INSERT INTO production_schedule_items (
    schedule_id, formula_id, formula_code, batches,
    materials_ok, shortages_json, total_required_kg
  )
  VALUES (
    v_schedule_id, p_formula_id, v_formula_code, p_batches,
    (v_materials_check->>'materials_ok')::boolean,
    COALESCE(v_materials_check->'shortages', '[]'::jsonb), 0
  )
  RETURNING id INTO v_schedule_item_id;
  
  RETURN jsonb_build_object(
    'ok', true,
    'schedule_item_id', v_schedule_item_id,
    'materials_ok', v_materials_check->>'materials_ok',
    'shortages', v_materials_check->'shortages'
  );
END;
$function$;
