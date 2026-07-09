-- Drop both existing versions of the function to start clean
DROP FUNCTION IF EXISTS public.check_packaging_availability(uuid, text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.check_packaging_availability(uuid, integer, integer, uuid, uuid, uuid);

-- Recreate the function with correct column references from v_packaging_balances
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_packaging_availability' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
  v_bottles jsonb := '[]';
  v_caps jsonb := '[]';
  v_labels jsonb := '[]';
BEGIN
  -- Get available bottles from v_packaging_balances
  -- Extract size from item_name (e.g., "250cc Bottle")
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pb.item_id,
      'name', pb.item_name,
      'size', p_bottle_size,
      'quantity', pb.on_hand,
      'available', (pb.on_hand >= p_quantity_needed)
    )
  )
  INTO v_bottles
  FROM v_packaging_balances pb
  WHERE pb.category = 'Bottles'
    AND pb.item_name ~* CONCAT(p_bottle_size::text, 'cc')
    AND (p_selected_bottle_id IS NULL OR pb.item_id = p_selected_bottle_id);

  -- Get available caps from v_packaging_balances
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pb.item_id,
      'name', pb.item_name,
      'size', p_bottle_size,
      'quantity', pb.on_hand,
      'available', (pb.on_hand >= p_quantity_needed)
    )
  )
  INTO v_caps
  FROM v_packaging_balances pb
  WHERE pb.category = 'Caps'
    AND pb.item_name ~* CONCAT(p_bottle_size::text, 'cc')
    AND (p_selected_cap_id IS NULL OR pb.item_id = p_selected_cap_id);

  -- Get available labels from label_inventory
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', li.id,
      'name', COALESCE(li.product_name, li.customer_product),
      'quantity', COALESCE(li.on_hand, 0),
      'available', (COALESCE(li.on_hand, 0) >= p_quantity_needed)
    )
  )
  INTO v_labels
  FROM label_inventory li
  WHERE (p_selected_label_inventory_id IS NULL OR li.id = p_selected_label_inventory_id);

  -- Build the result
  v_result := jsonb_build_object(
    'bottles', COALESCE(v_bottles, '[]'::jsonb),
    'caps', COALESCE(v_caps, '[]'::jsonb),
    'labels', COALESCE(v_labels, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;