-- Fix check_packaging_availability function to use correct column name
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_packaging_availability' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.check_packaging_availability(
  p_formula_id UUID,
  p_bottle_size TEXT,
  p_selected_bottle_id UUID DEFAULT NULL,
  p_selected_cap_id UUID DEFAULT NULL,
  p_selected_label_inventory_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_bottles JSON;
  v_caps JSON;
  v_labels JSON;
BEGIN
  -- Get available bottles
  SELECT json_build_object(
    'available', COALESCE(SUM(pb.on_hand), 0),
    'items', COALESCE(json_agg(
      json_build_object(
        'id', pb.id,
        'name', pb.name,
        'quantity', pb.on_hand,
        'size', pb.size
      ) ORDER BY pb.on_hand DESC
    ) FILTER (WHERE pb.id IS NOT NULL), '[]'::json)
  )
  INTO v_bottles
  FROM v_packaging_balances pb
  WHERE pb.category = 'bottle'
    AND pb.size = p_bottle_size
    AND (p_selected_bottle_id IS NULL OR pb.id = p_selected_bottle_id);

  -- Get available caps
  SELECT json_build_object(
    'available', COALESCE(SUM(pb.on_hand), 0),
    'items', COALESCE(json_agg(
      json_build_object(
        'id', pb.id,
        'name', pb.name,
        'quantity', pb.on_hand,
        'size', pb.size
      ) ORDER BY pb.on_hand DESC
    ) FILTER (WHERE pb.id IS NOT NULL), '[]'::json)
  )
  INTO v_caps
  FROM v_packaging_balances pb
  WHERE pb.category = 'cap'
    AND pb.size = p_bottle_size
    AND (p_selected_cap_id IS NULL OR pb.id = p_selected_cap_id);

  -- Get available labels
  SELECT json_build_object(
    'available', COALESCE(SUM(li.on_hand), 0),
    'items', COALESCE(json_agg(
      json_build_object(
        'id', li.id,
        'sku', li.sku,
        'quantity', li.on_hand,
        'formula_id', li.formula_id
      ) ORDER BY li.on_hand DESC
    ) FILTER (WHERE li.id IS NOT NULL), '[]'::json)
  )
  INTO v_labels
  FROM label_inventory li
  WHERE li.formula_id = p_formula_id
    AND (p_selected_label_inventory_id IS NULL OR li.id = p_selected_label_inventory_id);

  -- Combine results
  v_result := json_build_object(
    'bottles', v_bottles,
    'caps', v_caps,
    'labels', v_labels
  );

  RETURN v_result;
END;
$$;