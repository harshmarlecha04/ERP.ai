-- Fix table and column name references in get_material_requirements_by_date_range function
DROP FUNCTION IF EXISTS get_material_requirements_by_date_range(date, date);

CREATE OR REPLACE FUNCTION get_material_requirements_by_date_range(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  raw_material_id uuid,
  material_code text,
  material_name text,
  supplier text,
  uom text,
  total_required_kg numeric,
  current_inventory_kg numeric,
  reserved_kg numeric,
  available_kg numeric,
  on_order_kg numeric,
  net_shortage_kg numeric,
  net_after_orders_kg numeric,
  formulas_using jsonb,
  schedule_dates jsonb,
  pending_po_numbers jsonb,
  pending_po_details jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH schedule_items AS (
    SELECT 
      psi.id as schedule_item_id,
      psi.formula_id,
      psi.batches,
      ps.schedule_date,
      f.code as formula_code,
      f.name as formula_name,
      f.recipe_json,
      f.default_batch_size_kg
    FROM production_schedule_items psi
    JOIN production_schedules ps ON ps.id = psi.schedule_id
    JOIN formulas f ON f.id = psi.formula_id
    WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
      AND psi.current_stage IN ('scheduled', 'in_progress')
  ),
  material_requirements AS (
    SELECT 
      rm.id as raw_material_id,
      rm.code as material_code,
      rm.name as material_name,
      rm.supplier,
      rm.uom,
      si.formula_code,
      si.formula_name,
      si.batches,
      si.schedule_date,
      (recipe_item->>'percentage')::numeric / 100 * si.default_batch_size_kg * si.batches as required_kg
    FROM schedule_items si
    CROSS JOIN LATERAL jsonb_array_elements(si.recipe_json) AS recipe_item
    JOIN raw_materials rm ON (
      -- Exact match first
      rm.name = recipe_item->>'materialName'
      OR 
      -- Fuzzy match using similarity (threshold 0.6)
      similarity(rm.name, recipe_item->>'materialName') > 0.6
    )
    WHERE NOT rm.is_archived
  ),
  aggregated_requirements AS (
    SELECT 
      raw_material_id,
      material_code,
      material_name,
      supplier,
      uom,
      SUM(required_kg) as total_required_kg,
      jsonb_agg(DISTINCT jsonb_build_object(
        'formula_code', formula_code,
        'formula_name', formula_name,
        'batches', batches
      )) as formulas_using,
      jsonb_agg(DISTINCT schedule_date::text) as schedule_dates
    FROM material_requirements
    GROUP BY raw_material_id, material_code, material_name, supplier, uom
  ),
  inventory_status AS (
    SELECT 
      rm.id as raw_material_id,
      COALESCE(SUM(il.quantity), 0) as current_inventory_kg,
      COALESCE(SUM(ir.reserved_kg), 0) as reserved_kg
    FROM raw_materials rm
    LEFT JOIN raw_material_lots il ON il.raw_material_id = rm.id AND il.quantity > 0
    LEFT JOIN inventory_reservations ir ON ir.lot_id = il.id
    GROUP BY rm.id
  ),
  purchase_orders_summary AS (
    SELECT 
      rm.id as raw_material_id,
      COALESCE(SUM(po.quantity), 0) as on_order_kg,
      jsonb_agg(DISTINCT po.po_number) FILTER (WHERE po.po_number IS NOT NULL) as pending_po_numbers,
      jsonb_agg(DISTINCT jsonb_build_object(
        'po_number', po.po_number,
        'expected_delivery', po.expected_delivery::text
      )) FILTER (WHERE po.po_number IS NOT NULL) as pending_po_details
    FROM raw_materials rm
    LEFT JOIN purchase_orders po ON po.ingredient_name = rm.name 
      AND po.status = 'ordered'
      AND po.expected_delivery >= CURRENT_DATE
    GROUP BY rm.id
  )
  SELECT 
    ar.raw_material_id,
    ar.material_code,
    ar.material_name,
    ar.supplier,
    ar.uom,
    ar.total_required_kg,
    COALESCE(inv.current_inventory_kg, 0) as current_inventory_kg,
    COALESCE(inv.reserved_kg, 0) as reserved_kg,
    COALESCE(inv.current_inventory_kg - inv.reserved_kg, 0) as available_kg,
    COALESCE(po.on_order_kg, 0) as on_order_kg,
    GREATEST(ar.total_required_kg - COALESCE(inv.current_inventory_kg - inv.reserved_kg, 0), 0) as net_shortage_kg,
    GREATEST(ar.total_required_kg - COALESCE(inv.current_inventory_kg - inv.reserved_kg, 0) - COALESCE(po.on_order_kg, 0), 0) as net_after_orders_kg,
    ar.formulas_using,
    ar.schedule_dates,
    COALESCE(po.pending_po_numbers, '[]'::jsonb) as pending_po_numbers,
    COALESCE(po.pending_po_details, '[]'::jsonb) as pending_po_details
  FROM aggregated_requirements ar
  LEFT JOIN inventory_status inv ON inv.raw_material_id = ar.raw_material_id
  LEFT JOIN purchase_orders_summary po ON po.raw_material_id = ar.raw_material_id
  ORDER BY ar.material_name;
END;
$$;