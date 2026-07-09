-- Fix security warning: Add search_path to check_packaging_availability function
DROP FUNCTION IF EXISTS check_packaging_availability(uuid, integer, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION check_packaging_availability(
  p_formula_id uuid,
  p_bottle_size integer,
  p_selected_bottle_id uuid DEFAULT NULL,
  p_selected_cap_id uuid DEFAULT NULL,
  p_selected_label_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_result json;
BEGIN
  -- Get customer_id from formula
  SELECT customer_id INTO v_customer_id
  FROM formulas
  WHERE id = p_formula_id;

  -- Build the result with all three categories
  SELECT json_build_object(
    'bottles', COALESCE((
      SELECT json_build_object(
        'available', COALESCE(SUM(pb.quantity), 0),
        'items', COALESCE(json_agg(
          json_build_object(
            'item_id', pb.item_id,
            'item_name', pb.item_name,
            'quantity', pb.quantity
          ) ORDER BY pb.item_name
        ) FILTER (WHERE pb.item_id IS NOT NULL), '[]'::json)
      )
      FROM v_packaging_balances pb
      WHERE pb.category = 'BOTTLES'
        AND (p_selected_bottle_id IS NULL OR pb.item_id = p_selected_bottle_id)
    ), json_build_object('available', 0, 'items', '[]'::json)),
    
    'caps', COALESCE((
      SELECT json_build_object(
        'available', COALESCE(SUM(pb.quantity), 0),
        'items', COALESCE(json_agg(
          json_build_object(
            'item_id', pb.item_id,
            'item_name', pb.item_name,
            'quantity', pb.quantity
          ) ORDER BY pb.item_name
        ) FILTER (WHERE pb.item_id IS NOT NULL), '[]'::json)
      )
      FROM v_packaging_balances pb
      WHERE pb.category = 'CAPS'
        AND (p_selected_cap_id IS NULL OR pb.item_id = p_selected_cap_id)
    ), json_build_object('available', 0, 'items', '[]'::json)),
    
    'labels', COALESCE((
      SELECT json_build_object(
        'available', COALESCE(SUM(li.on_hand), 0),
        'items', COALESCE(json_agg(
          json_build_object(
            'item_id', li.id,
            'item_name', li.customer_product,
            'quantity', li.on_hand
          ) ORDER BY li.customer_product
        ) FILTER (WHERE li.id IS NOT NULL), '[]'::json)
      )
      FROM label_inventory li
      WHERE li.customer_id = v_customer_id
        AND (p_selected_label_id IS NULL OR li.id = p_selected_label_id)
    ), json_build_object('available', 0, 'items', '[]'::json))
  ) INTO v_result;

  RETURN v_result;
END;
$$;