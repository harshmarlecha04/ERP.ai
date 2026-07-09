-- Fix check_packaging_availability function to use correct column names
CREATE OR REPLACE FUNCTION check_packaging_availability(
  p_formula_id UUID,
  p_bottles_needed INTEGER,
  p_bottle_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_bottles_available NUMERIC := 0;
  v_caps_available NUMERIC := 0;
  v_labels_available NUMERIC := 0;
  v_customer_id UUID;
BEGIN
  -- Get customer_id from formula
  SELECT customer_id INTO v_customer_id
  FROM formulas
  WHERE id = p_formula_id;

  -- Get bottles availability
  SELECT COALESCE(SUM(on_hand), 0) INTO v_bottles_available
  FROM v_packaging_balances
  WHERE category = 'BOTTLES';
  
  -- Get caps availability
  SELECT COALESCE(SUM(on_hand), 0) INTO v_caps_available
  FROM v_packaging_balances
  WHERE category = 'CAPS';
  
  -- Get labels availability (from label_inventory table using customer_id)
  SELECT COALESCE(SUM(on_hand), 0) INTO v_labels_available
  FROM label_inventory
  WHERE customer_id = v_customer_id;
  
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