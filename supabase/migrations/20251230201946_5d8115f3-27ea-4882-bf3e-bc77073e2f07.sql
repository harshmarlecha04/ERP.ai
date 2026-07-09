-- Drop the incorrectly created function with wrong parameter order
DROP FUNCTION IF EXISTS fn_create_schedule_item(uuid, date, integer, uuid, integer, uuid, uuid, uuid, uuid, text, text);

-- Update the existing function to support optional formula and manual entry
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='fn_create_schedule_item' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION fn_create_schedule_item(
  p_schedule_date date,
  p_formula_id uuid DEFAULT NULL,
  p_batches integer DEFAULT 1,
  p_manual_customer_name text DEFAULT NULL,
  p_manual_formula_name text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_schedule_id uuid;
  v_formula_code text;
  v_materials_check jsonb;
  v_schedule_item_id uuid;
BEGIN
  -- If formula_id is provided, get formula code and check materials
  IF p_formula_id IS NOT NULL THEN
    SELECT code INTO v_formula_code
    FROM formulas
    WHERE id = p_formula_id;

    IF v_formula_code IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Formula not found');
    END IF;

    -- Check materials availability
    v_materials_check := fn_check_materials(p_formula_id, p_batches, p_schedule_date);
  ELSE
    -- Manual entry mode - no formula lookup needed
    v_formula_code := NULL;
    v_materials_check := jsonb_build_object('materials_ok', true, 'shortages', '[]'::jsonb);
  END IF;
  
  -- Get or create schedule for the date
  SELECT id INTO v_schedule_id
  FROM production_schedules
  WHERE schedule_date = p_schedule_date;
  
  IF v_schedule_id IS NULL THEN
    INSERT INTO production_schedules (schedule_date, status, created_by)
    VALUES (p_schedule_date, 'scheduled', auth.uid())
    RETURNING id INTO v_schedule_id;
  END IF;
  
  -- Create schedule item
  INSERT INTO production_schedule_items (
    schedule_id,
    formula_id,
    formula_code,
    batches,
    materials_ok,
    shortages_json,
    total_required_kg,
    manual_customer_name,
    manual_formula_name
  )
  VALUES (
    v_schedule_id,
    p_formula_id,
    v_formula_code,
    p_batches,
    (v_materials_check->>'materials_ok')::boolean,
    COALESCE(v_materials_check->'shortages', '[]'::jsonb),
    0,
    p_manual_customer_name,
    p_manual_formula_name
  )
  RETURNING id INTO v_schedule_item_id;
  
  -- Return success with materials check info
  RETURN jsonb_build_object(
    'ok', true,
    'schedule_item_id', v_schedule_item_id,
    'materials_ok', v_materials_check->>'materials_ok',
    'shortages', v_materials_check->'shortages'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';