-- Update check_packaging_availability to support specific item selection
CREATE OR REPLACE FUNCTION check_packaging_availability(
  p_formula_id UUID,
  p_bottles_needed INTEGER,
  p_bottle_size INTEGER,
  p_selected_bottle_id UUID DEFAULT NULL,
  p_selected_cap_id UUID DEFAULT NULL,
  p_selected_label_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_result JSONB;
  v_bottles JSONB;
  v_caps JSONB;
  v_labels JSONB;
BEGIN
  -- Get customer_id from formula
  SELECT customer_id INTO v_customer_id
  FROM formulas
  WHERE id = p_formula_id;

  -- Check bottles
  IF p_selected_bottle_id IS NOT NULL THEN
    -- Check specific bottle
    SELECT jsonb_build_object(
      'status', CASE 
        WHEN COALESCE(SUM(pi.on_hand), 0) >= p_bottles_needed THEN 'available'
        WHEN COALESCE(SUM(pi.on_hand), 0) > 0 THEN 'partial'
        ELSE 'critical'
      END,
      'total_available', COALESCE(SUM(pi.on_hand), 0),
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pi.on_hand), 0)),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'item_id', pi.item_id,
          'item_name', pi.item_name,
          'description', pi.description,
          'sku', pi.sku,
          'on_hand', pi.on_hand,
          'location', pi.location
        )
      ), '[]'::jsonb)
    ) INTO v_bottles
    FROM packaging_item pi
    WHERE pi.item_id = p_selected_bottle_id
      AND pi.category = 'bottles'
      AND pi.bottle_size = p_bottle_size;
  ELSE
    -- Aggregate all bottles
    SELECT jsonb_build_object(
      'status', CASE 
        WHEN COALESCE(SUM(pi.on_hand), 0) >= p_bottles_needed THEN 'available'
        WHEN COALESCE(SUM(pi.on_hand), 0) > 0 THEN 'partial'
        ELSE 'critical'
      END,
      'total_available', COALESCE(SUM(pi.on_hand), 0),
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pi.on_hand), 0)),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'item_id', pi.item_id,
          'item_name', pi.item_name,
          'description', pi.description,
          'sku', pi.sku,
          'on_hand', pi.on_hand,
          'location', pi.location
        )
      ), '[]'::jsonb)
    ) INTO v_bottles
    FROM packaging_item pi
    WHERE pi.category = 'bottles'
      AND pi.bottle_size = p_bottle_size
      AND pi.on_hand > 0;
  END IF;

  -- Check caps
  IF p_selected_cap_id IS NOT NULL THEN
    -- Check specific cap
    SELECT jsonb_build_object(
      'status', CASE 
        WHEN COALESCE(SUM(pi.on_hand), 0) >= p_bottles_needed THEN 'available'
        WHEN COALESCE(SUM(pi.on_hand), 0) > 0 THEN 'partial'
        ELSE 'critical'
      END,
      'total_available', COALESCE(SUM(pi.on_hand), 0),
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pi.on_hand), 0)),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'item_id', pi.item_id,
          'item_name', pi.item_name,
          'description', pi.description,
          'sku', pi.sku,
          'on_hand', pi.on_hand,
          'location', pi.location
        )
      ), '[]'::jsonb)
    ) INTO v_caps
    FROM packaging_item pi
    WHERE pi.item_id = p_selected_cap_id
      AND pi.category = 'caps';
  ELSE
    -- Aggregate all caps
    SELECT jsonb_build_object(
      'status', CASE 
        WHEN COALESCE(SUM(pi.on_hand), 0) >= p_bottles_needed THEN 'available'
        WHEN COALESCE(SUM(pi.on_hand), 0) > 0 THEN 'partial'
        ELSE 'critical'
      END,
      'total_available', COALESCE(SUM(pi.on_hand), 0),
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(pi.on_hand), 0)),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'item_id', pi.item_id,
          'item_name', pi.item_name,
          'description', pi.description,
          'sku', pi.sku,
          'on_hand', pi.on_hand,
          'location', pi.location
        )
      ), '[]'::jsonb)
    ) INTO v_caps
    FROM packaging_item pi
    WHERE pi.category = 'caps'
      AND pi.on_hand > 0;
  END IF;

  -- Check labels
  IF p_selected_label_id IS NOT NULL THEN
    -- Check specific label
    SELECT jsonb_build_object(
      'status', CASE 
        WHEN COALESCE(SUM(li.on_hand), 0) >= p_bottles_needed THEN 'available'
        WHEN COALESCE(SUM(li.on_hand), 0) > 0 THEN 'partial'
        ELSE 'critical'
      END,
      'available', COALESCE(SUM(li.on_hand), 0),
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(li.on_hand), 0)),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'label_id', li.id,
          'customer_product', li.customer_product,
          'product_name', li.product_name,
          'on_hand', li.on_hand
        )
      ), '[]'::jsonb)
    ) INTO v_labels
    FROM label_inventory li
    WHERE li.id = p_selected_label_id;
  ELSE
    -- Aggregate all labels for customer
    SELECT jsonb_build_object(
      'status', CASE 
        WHEN COALESCE(SUM(li.on_hand), 0) >= p_bottles_needed THEN 'available'
        WHEN COALESCE(SUM(li.on_hand), 0) > 0 THEN 'partial'
        ELSE 'critical'
      END,
      'available', COALESCE(SUM(li.on_hand), 0),
      'needed', p_bottles_needed,
      'shortage', GREATEST(0, p_bottles_needed - COALESCE(SUM(li.on_hand), 0)),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'label_id', li.id,
          'customer_product', li.customer_product,
          'product_name', li.product_name,
          'on_hand', li.on_hand
        )
      ), '[]'::jsonb)
    ) INTO v_labels
    FROM label_inventory li
    WHERE li.customer_id = v_customer_id
      AND li.on_hand > 0;
  END IF;

  -- Build final result
  v_result := jsonb_build_object(
    'bottles', COALESCE(v_bottles, '{"status":"critical","total_available":0,"needed":0,"shortage":0,"items":[]}'::jsonb),
    'caps', COALESCE(v_caps, '{"status":"critical","total_available":0,"needed":0,"shortage":0,"items":[]}'::jsonb),
    'labels', COALESCE(v_labels, '{"status":"critical","available":0,"needed":0,"shortage":0,"items":[]}'::jsonb)
  );

  RETURN v_result;
END;
$$;