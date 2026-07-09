-- Fix case sensitivity in check_packaging_availability function
DROP FUNCTION IF EXISTS public.check_packaging_availability(uuid, integer, integer, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.check_packaging_availability(
  p_formula_id uuid,
  p_bottle_size integer,
  p_quantity_needed integer,
  p_selected_bottle_id uuid DEFAULT NULL,
  p_selected_cap_id uuid DEFAULT NULL,
  p_selected_label_inventory_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}';
  v_bottles jsonb;
  v_caps jsonb;
  v_labels jsonb;
  v_bottles_available integer := 0;
  v_caps_available integer := 0;
  v_labels_available integer := 0;
BEGIN
  -- Get available bottles from v_packaging_balances
  SELECT 
    jsonb_build_object(
      'available', COALESCE(SUM(pb.on_hand), 0),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'item_id', pb.item_id,
          'item_name', pb.item_name,
          'description', pb.description,
          'sku', pb.sku,
          'on_hand', pb.on_hand,
          'location', pb.location
        )
      ) FILTER (WHERE pb.on_hand > 0), '[]'::jsonb)
    ),
    COALESCE(SUM(pb.on_hand), 0)
  INTO v_bottles, v_bottles_available
  FROM v_packaging_balances pb
  WHERE pb.category = 'BOTTLES'
    AND pb.item_name ~* CONCAT(p_bottle_size::text, 'cc')
    AND (p_selected_bottle_id IS NULL OR pb.item_id = p_selected_bottle_id);

  -- Get available caps from v_packaging_balances
  SELECT 
    jsonb_build_object(
      'available', COALESCE(SUM(pb.on_hand), 0),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'item_id', pb.item_id,
          'item_name', pb.item_name,
          'description', pb.description,
          'sku', pb.sku,
          'on_hand', pb.on_hand,
          'location', pb.location
        )
      ) FILTER (WHERE pb.on_hand > 0), '[]'::jsonb)
    ),
    COALESCE(SUM(pb.on_hand), 0)
  INTO v_caps, v_caps_available
  FROM v_packaging_balances pb
  WHERE pb.category = 'CAPS'
    AND (p_selected_cap_id IS NULL OR pb.item_id = p_selected_cap_id);

  -- Get available labels from label_inventory
  SELECT 
    jsonb_build_object(
      'available', COALESCE(SUM(COALESCE(li.on_hand, 0)), 0),
      'items', COALESCE(jsonb_agg(
        jsonb_build_object(
          'label_id', li.id,
          'customer_product', li.customer_product,
          'product_name', li.product_name,
          'on_hand', COALESCE(li.on_hand, 0)
        )
      ) FILTER (WHERE COALESCE(li.on_hand, 0) > 0), '[]'::jsonb)
    ),
    COALESCE(SUM(COALESCE(li.on_hand, 0)), 0)
  INTO v_labels, v_labels_available
  FROM label_inventory li
  WHERE (p_selected_label_inventory_id IS NULL OR li.id = p_selected_label_inventory_id);

  -- Build the result
  v_result := jsonb_build_object(
    'bottles', COALESCE(v_bottles, jsonb_build_object('available', 0, 'items', '[]'::jsonb)),
    'caps', COALESCE(v_caps, jsonb_build_object('available', 0, 'items', '[]'::jsonb)),
    'labels', COALESCE(v_labels, jsonb_build_object('available', 0, 'items', '[]'::jsonb))
  );

  RETURN v_result;
END;
$$;