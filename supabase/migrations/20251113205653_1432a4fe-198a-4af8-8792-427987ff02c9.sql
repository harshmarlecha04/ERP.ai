-- Complete rewrite of check_packaging_availability to use correct tables and columns
DROP FUNCTION IF EXISTS check_packaging_availability(uuid, integer, integer, uuid, uuid, uuid);

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_packaging_availability' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
  -- Get bottle availability from v_packaging_balances view
  -- Match bottle size by extracting from item_name (e.g., "Clear 250cc Bottle")
  SELECT json_build_object(
    'status', CASE 
      WHEN COALESCE(SUM(pb.on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(pb.on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'available', COALESCE(SUM(pb.on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pb.on_hand), 0)),
    'items', COALESCE(json_agg(json_build_object(
      'item_id', pb.item_id,
      'item_name', pb.item_name,
      'description', pb.description,
      'sku', pb.sku,
      'on_hand', pb.on_hand
    )), '[]'::json)
  ) INTO bottle_data
  FROM v_packaging_balances pb
  WHERE pb.category = 'BOTTLES'
    AND pb.item_name ~* CONCAT(p_bottle_size::text, 'cc')
    AND (p_selected_bottle_id IS NULL OR pb.item_id = p_selected_bottle_id);

  -- Get cap availability from v_packaging_balances view
  -- Match cap size by extracting from item_name
  SELECT json_build_object(
    'status', CASE 
      WHEN COALESCE(SUM(pb.on_hand), 0) >= p_bottles_needed THEN 'available'
      WHEN COALESCE(SUM(pb.on_hand), 0) > 0 THEN 'partial'
      ELSE 'critical'
    END,
    'available', COALESCE(SUM(pb.on_hand), 0),
    'needed', p_bottles_needed,
    'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pb.on_hand), 0)),
    'items', COALESCE(json_agg(json_build_object(
      'item_id', pb.item_id,
      'item_name', pb.item_name,
      'description', pb.description,
      'sku', pb.sku,
      'on_hand', pb.on_hand
    )), '[]'::json)
  ) INTO cap_data
  FROM v_packaging_balances pb
  WHERE pb.category = 'CAPS'
    AND pb.item_name ~* CONCAT(p_bottle_size::text, 'cc')
    AND (p_selected_cap_id IS NULL OR pb.item_id = p_selected_cap_id);

  -- Get label availability from label_inventory table
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