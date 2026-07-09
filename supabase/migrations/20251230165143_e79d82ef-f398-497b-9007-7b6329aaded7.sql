-- Make formula_id and formula_code nullable
ALTER TABLE production_schedule_items 
  ALTER COLUMN formula_id DROP NOT NULL,
  ALTER COLUMN formula_code DROP NOT NULL;

-- Add columns for manual entry
ALTER TABLE production_schedule_items 
  ADD COLUMN IF NOT EXISTS manual_customer_name text,
  ADD COLUMN IF NOT EXISTS manual_formula_name text;

-- Update the fn_create_schedule_item function to handle optional formula and manual entries
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='fn_create_schedule_item' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION fn_create_schedule_item(
  p_formula_id uuid,
  p_scheduled_date date,
  p_batches integer,
  p_order_header_id uuid DEFAULT NULL,
  p_estimated_bottles integer DEFAULT NULL,
  p_selected_bottle_id uuid DEFAULT NULL,
  p_selected_cap_id uuid DEFAULT NULL,
  p_selected_label_id uuid DEFAULT NULL,
  p_selected_corrugated_id uuid DEFAULT NULL,
  p_manual_customer_name text DEFAULT NULL,
  p_manual_formula_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_formula RECORD;
  v_schedule_id uuid;
  v_total_required_kg numeric;
  v_formula_code text;
BEGIN
  -- If formula_id is provided, look it up
  IF p_formula_id IS NOT NULL THEN
    SELECT id, code, default_batch_size_kg, name
    INTO v_formula
    FROM formulas
    WHERE id = p_formula_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Formula not found';
    END IF;

    v_total_required_kg := v_formula.default_batch_size_kg * p_batches;
    v_formula_code := v_formula.code;
  ELSE
    -- Manual entry mode - no formula lookup needed
    v_total_required_kg := 0;
    v_formula_code := NULL;
  END IF;

  -- Insert the schedule item
  INSERT INTO production_schedule_items (
    formula_id,
    formula_code,
    scheduled_date,
    batches,
    total_required_kg,
    order_header_id,
    estimated_bottles,
    selected_bottle_id,
    selected_cap_id,
    selected_label_id,
    selected_corrugated_id,
    manual_customer_name,
    manual_formula_name
  ) VALUES (
    p_formula_id,
    v_formula_code,
    p_scheduled_date,
    p_batches,
    v_total_required_kg,
    p_order_header_id,
    p_estimated_bottles,
    p_selected_bottle_id,
    p_selected_cap_id,
    p_selected_label_id,
    p_selected_corrugated_id,
    p_manual_customer_name,
    p_manual_formula_name
  )
  RETURNING id INTO v_schedule_id;

  RETURN v_schedule_id;
END;
$$;