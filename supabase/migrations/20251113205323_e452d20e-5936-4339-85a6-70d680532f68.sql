-- Fix check_packaging_availability function to use correct column names
DROP FUNCTION IF EXISTS check_packaging_availability(uuid, integer, integer, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION check_packaging_availability(
  p_formula_id UUID,
  p_bottles_needed INTEGER,
  p_bottle_size INTEGER,
  p_selected_bottle_id UUID DEFAULT NULL,
  p_selected_cap_id UUID DEFAULT NULL,
  p_selected_label_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  bottle_data JSON;
  cap_data JSON;
  label_data JSON;
BEGIN
  -- Get bottle availability
  SELECT json_build_object(
    'status', CASE 
      WHEN COALESCE(SUM(pi.quantity_on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(pi.quantity_on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'available', COALESCE(SUM(pi.quantity_on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pi.quantity_on_hand), 0)),
    'items', COALESCE(json_agg(json_build_object(
      'item_id', pi.id,
      'item_name', pi.item_name,
      'description', pi.description,
      'sku', pi.sku,
      'on_hand', pi.quantity_on_hand,
      'location', pi.location
    )), '[]'::json)
  ) INTO bottle_data
  FROM packaging_inventory pi
  WHERE pi.category = 'bottles'
    AND pi.bottle_size = p_bottle_size
    AND (p_selected_bottle_id IS NULL OR pi.id = p_selected_bottle_id);

  -- Get cap availability
  SELECT json_build_object(
    'status', CASE 
      WHEN COALESCE(SUM(pi.quantity_on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(pi.quantity_on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'available', COALESCE(SUM(pi.quantity_on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pi.quantity_on_hand), 0)),
    'items', COALESCE(json_agg(json_build_object(
      'item_id', pi.id,
      'item_name', pi.item_name,
      'description', pi.description,
      'sku', pi.sku,
      'on_hand', pi.quantity_on_hand,
      'location', pi.location
    )), '[]'::json)
  ) INTO cap_data
  FROM packaging_inventory pi
  WHERE pi.category = 'caps'
    AND pi.bottle_size = p_bottle_size
    AND (p_selected_cap_id IS NULL OR pi.id = p_selected_cap_id);

  -- Get label availability
  SELECT json_build_object(
    'status', CASE 
      WHEN COALESCE(SUM(li.on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(li.on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'available', COALESCE(SUM(li.on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(li.on_hand), 0)),
    'items', COALESCE(json_agg(json_build_object(
      'label_id', li.id,
      'customer_product', li.customer_product,
      'product_name', li.product_name,
      'on_hand', li.on_hand
    )), '[]'::json)
  ) INTO label_data
  FROM label_inventory li
  WHERE li.customer_id = (SELECT customer_id FROM formulas WHERE id = p_formula_id)
    AND (p_selected_label_id IS NULL OR li.id = p_selected_label_id);

  -- Combine results
  result := json_build_object(
    'bottles', bottle_data,
    'caps', cap_data,
    'labels', label_data
  );

  RETURN result;
END;
$$;