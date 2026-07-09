-- Create function to check packaging availability for orders
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_packaging_availability' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION check_packaging_availability(
  p_formula_id UUID,
  p_bottles_needed INTEGER,
  p_bottle_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_bottles_available NUMERIC := 0;
  v_caps_available NUMERIC := 0;
  v_labels_available NUMERIC := 0;
BEGIN
  -- Get bottles availability
  SELECT COALESCE(SUM(on_hand), 0) INTO v_bottles_available
  FROM v_packaging_balances
  WHERE category = 'BOTTLES' 
    AND (item_name ILIKE '%' || p_bottle_size::TEXT || '%' OR item_name ILIKE '%' || p_bottle_size::TEXT || 'ct%');

  -- Get caps availability
  SELECT COALESCE(SUM(on_hand), 0) INTO v_caps_available
  FROM v_packaging_balances
  WHERE category = 'CAPS';

  -- Get labels availability (from label_inventory table)
  SELECT COALESCE(SUM(quantity), 0) INTO v_labels_available
  FROM label_inventory
  WHERE formula_id = p_formula_id;

  -- Build result
  v_result := jsonb_build_object(
    'bottles', jsonb_build_object(
      'available', v_bottles_available,
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - v_bottles_available),
      'status', CASE 
        WHEN v_bottles_available >= p_bottles_needed THEN 'available'
        WHEN v_bottles_available > 0 THEN 'partial'
        ELSE 'critical'
      END
    ),
    'caps', jsonb_build_object(
      'available', v_caps_available,
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - v_caps_available),
      'status', CASE 
        WHEN v_caps_available >= p_bottles_needed THEN 'available'
        WHEN v_caps_available > 0 THEN 'partial'
        ELSE 'critical'
      END
    ),
    'labels', jsonb_build_object(
      'available', v_labels_available,
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - v_labels_available),
      'status', CASE 
        WHEN v_labels_available >= p_bottles_needed THEN 'available'
        WHEN v_labels_available > 0 THEN 'partial'
        ELSE 'critical'
      END
    )
  );

  RETURN v_result;
END;
$$;