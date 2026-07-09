-- Fix fn_create_schedule_item to properly set formula_code
CREATE OR REPLACE FUNCTION fn_create_schedule_item(
  p_schedule_date date,
  p_formula_id uuid,
  p_batches integer
)
RETURNS jsonb AS $$
DECLARE
  v_schedule_id uuid;
  v_formula_code text;
  v_materials_check jsonb;
  v_schedule_item_id uuid;
BEGIN
  -- Get the formula code
  SELECT code INTO v_formula_code
  FROM formulas
  WHERE id = p_formula_id;

  IF v_formula_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Formula not found');
  END IF;

  -- Check materials availability
  v_materials_check := fn_check_materials(p_formula_id, p_batches, p_schedule_date);
  
  -- Get or create schedule for the date
  SELECT id INTO v_schedule_id
  FROM production_schedules
  WHERE schedule_date = p_schedule_date;
  
  IF v_schedule_id IS NULL THEN
    INSERT INTO production_schedules (schedule_date, status, created_by)
    VALUES (p_schedule_date, 'scheduled', auth.uid())
    RETURNING id INTO v_schedule_id;
  END IF;
  
  -- Create schedule item with formula_code
  INSERT INTO production_schedule_items (
    schedule_id,
    formula_id,
    formula_code,
    batches,
    materials_ok,
    shortages_json,
    total_required_kg
  )
  VALUES (
    v_schedule_id,
    p_formula_id,
    v_formula_code,
    p_batches,
    (v_materials_check->>'materials_ok')::boolean,
    COALESCE(v_materials_check->'shortages', '[]'::jsonb),
    0
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
$$ LANGUAGE plpgsql SECURITY DEFINER;