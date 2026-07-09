-- Enhance check_packaging_availability to return detailed item information
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
  v_bottles_data JSONB;
  v_caps_data JSONB;
  v_labels_data JSONB;
  v_customer_id UUID;
BEGIN
  -- Get customer_id from formula
  SELECT customer_id INTO v_customer_id
  FROM formulas
  WHERE id = p_formula_id;

  -- Get detailed bottles availability (filter by bottle size)
  SELECT jsonb_build_object(
    'total_available', COALESCE(SUM(on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(on_hand), 0)),
    'status', CASE 
      WHEN COALESCE(SUM(on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'items', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'item_id', item_id,
          'item_name', item_name,
          'description', description,
          'sku', sku,
          'on_hand', on_hand,
          'location', location
        ) ORDER BY on_hand DESC
      ) FILTER (WHERE on_hand > 0),
      '[]'::jsonb
    )
  ) INTO v_bottles_data
  FROM v_packaging_balances
  WHERE category = 'BOTTLES'
    AND (
      item_name ILIKE '%' || p_bottle_size::TEXT || 'ct%' 
      OR item_name ILIKE '%' || p_bottle_size::TEXT || ' count%'
      OR description ILIKE '%' || p_bottle_size::TEXT || 'ct%'
      OR p_bottle_size = 0  -- Include all if bottle size not specified
    );
  
  -- Get detailed caps availability
  SELECT jsonb_build_object(
    'total_available', COALESCE(SUM(on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(on_hand), 0)),
    'status', CASE 
      WHEN COALESCE(SUM(on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'items', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'item_id', item_id,
          'item_name', item_name,
          'description', description,
          'sku', sku,
          'on_hand', on_hand,
          'location', location
        ) ORDER BY on_hand DESC
      ) FILTER (WHERE on_hand > 0),
      '[]'::jsonb
    )
  ) INTO v_caps_data
  FROM v_packaging_balances
  WHERE category = 'CAPS';
  
  -- Get detailed labels availability
  SELECT jsonb_build_object(
    'total_available', COALESCE(SUM(on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(on_hand), 0)),
    'status', CASE 
      WHEN COALESCE(SUM(on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'items', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'label_id', id,
          'customer_product', customer_product,
          'product_name', product_name,
          'on_hand', on_hand
        ) ORDER BY on_hand DESC
      ) FILTER (WHERE on_hand > 0),
      '[]'::jsonb
    )
  ) INTO v_labels_data
  FROM label_inventory
  WHERE customer_id = v_customer_id;
  
  -- Build result with detailed items
  v_result := jsonb_build_object(
    'bottles', COALESCE(v_bottles_data, jsonb_build_object(
      'total_available', 0, 'needed', p_bottles_needed, 'shortage', p_bottles_needed,
      'status', 'critical', 'items', '[]'::jsonb
    )),
    'caps', COALESCE(v_caps_data, jsonb_build_object(
      'total_available', 0, 'needed', p_bottles_needed, 'shortage', p_bottles_needed,
      'status', 'critical', 'items', '[]'::jsonb
    )),
    'labels', COALESCE(v_labels_data, jsonb_build_object(
      'total_available', 0, 'needed', p_bottles_needed, 'shortage', p_bottles_needed,
      'status', 'critical', 'items', '[]'::jsonb
    ))
  );
  
  RETURN v_result;
END;
$$;