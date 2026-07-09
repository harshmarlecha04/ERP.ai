-- Fix security: Set search_path for check_packaging_availability function
DROP FUNCTION IF EXISTS check_packaging_availability(uuid, integer, integer, uuid, uuid, uuid);

CREATE FUNCTION check_packaging_availability(
  p_formula_id UUID,
  p_batches_needed INTEGER,
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
  v_result JSONB;
  v_bottles JSONB;
  v_caps JSONB;
  v_labels JSONB;
BEGIN
  -- Calculate bottles needed with fixed filtering logic
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_id', pb.item_id,
      'item_name', pb.item_name,
      'available_quantity', pb.on_hand,
      'needed_quantity', p_batches_needed * p_bottle_size,
      'status', CASE 
        WHEN pb.on_hand >= (p_batches_needed * p_bottle_size) THEN 'sufficient'
        WHEN pb.on_hand > 0 THEN 'partial'
        ELSE 'insufficient'
      END
    )
  ) INTO v_bottles
  FROM v_packaging_balances pb
  WHERE pb.category = 'BOTTLES'
    AND (
      (p_selected_bottle_id IS NOT NULL AND pb.item_id = p_selected_bottle_id)
      OR
      (p_selected_bottle_id IS NULL AND pb.item_name ~* CONCAT(p_bottle_size::text, 'cc'))
    );

  -- Calculate caps needed
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_id', pb.item_id,
      'item_name', pb.item_name,
      'available_quantity', pb.on_hand,
      'needed_quantity', p_batches_needed * p_bottle_size,
      'status', CASE 
        WHEN pb.on_hand >= (p_batches_needed * p_bottle_size) THEN 'sufficient'
        WHEN pb.on_hand > 0 THEN 'partial'
        ELSE 'insufficient'
      END
    )
  ) INTO v_caps
  FROM v_packaging_balances pb
  WHERE pb.category = 'CAPS'
    AND (p_selected_cap_id IS NULL OR pb.item_id = p_selected_cap_id);

  -- Calculate labels needed
  SELECT jsonb_agg(
    jsonb_build_object(
      'label_id', li.id,
      'customer_product', li.customer_product,
      'product_name', li.product_name,
      'available_quantity', COALESCE(li.on_hand, 0),
      'needed_quantity', p_batches_needed * p_bottle_size,
      'status', CASE 
        WHEN COALESCE(li.on_hand, 0) >= (p_batches_needed * p_bottle_size) THEN 'sufficient'
        WHEN COALESCE(li.on_hand, 0) > 0 THEN 'partial'
        ELSE 'insufficient'
      END
    )
  ) INTO v_labels
  FROM label_inventory li
  WHERE p_selected_label_id IS NULL OR li.id = p_selected_label_id;

  -- Build final result
  v_result := jsonb_build_object(
    'bottles', COALESCE(v_bottles, '[]'::jsonb),
    'caps', COALESCE(v_caps, '[]'::jsonb),
    'labels', COALESCE(v_labels, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;