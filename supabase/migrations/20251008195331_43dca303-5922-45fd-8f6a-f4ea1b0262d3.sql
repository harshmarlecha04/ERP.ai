-- Drop existing function first
DROP FUNCTION IF EXISTS get_material_requirements_by_date_range(date, date);

-- Recreate with updated return type to include purchase order data
CREATE OR REPLACE FUNCTION get_material_requirements_by_date_range(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
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
  suggested_order_kg numeric,
  formulas_using jsonb,
  schedule_dates jsonb,
  pending_po_numbers jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH scheduled_requirements AS (
    -- Get all ingredient requirements from scheduled production
    SELECT 
      piu.raw_material_id,
      SUM(piu.required_quantity_kg) as total_required,
      jsonb_agg(DISTINCT jsonb_build_object(
        'formula_code', psi.formula_code,
        'batches', piu.batches_used
      )) as formulas,
      jsonb_agg(DISTINCT ps.schedule_date ORDER BY ps.schedule_date) as dates
    FROM production_ingredient_usage piu
    JOIN production_schedule_items psi ON psi.id = piu.schedule_item_id
    JOIN production_schedules ps ON ps.id = psi.schedule_id
    WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
      AND ps.status != 'completed'
    GROUP BY piu.raw_material_id
  ),
  inventory_status AS (
    -- Get current inventory status per material
    SELECT 
      rml.raw_material_id,
      SUM(rml.quantity) as total_inventory,
      SUM(rml.qty_reserved_kg) as total_reserved,
      SUM(rml.quantity - rml.qty_reserved_kg) as total_available
    FROM raw_material_lots rml
    GROUP BY rml.raw_material_id
  ),
  pending_orders AS (
    -- Get pending purchase orders (ordered but not yet received)
    SELECT 
      rm.id as raw_material_id,
      SUM(poi.quantity) as total_on_order,
      jsonb_agg(DISTINCT po.po_number ORDER BY po.po_number) as po_numbers
    FROM purchase_orders po
    JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    JOIN raw_materials rm ON LOWER(rm.name) = LOWER(poi.ingredient_name)
    WHERE po.status = 'ordered'
      AND po.expected_delivery BETWEEN CURRENT_DATE AND p_end_date
    GROUP BY rm.id
  )
  SELECT 
    rm.id as raw_material_id,
    rm.code as material_code,
    rm.name as material_name,
    rm.supplier,
    rm.uom,
    COALESCE(sr.total_required, 0) as total_required_kg,
    COALESCE(inv.total_inventory, 0) as current_inventory_kg,
    COALESCE(inv.total_reserved, 0) as reserved_kg,
    COALESCE(inv.total_available, 0) as available_kg,
    COALESCE(po.total_on_order, 0) as on_order_kg,
    -- Original net shortage (without considering pending orders)
    GREATEST(COALESCE(sr.total_required, 0) - COALESCE(inv.total_available, 0), 0) as net_shortage_kg,
    -- True net shortage after considering pending orders
    GREATEST(COALESCE(sr.total_required, 0) - COALESCE(inv.total_available, 0) - COALESCE(po.total_on_order, 0), 0) as net_after_orders_kg,
    -- Suggested order: true shortage + 20% safety stock
    GREATEST(
      CEILING((COALESCE(sr.total_required, 0) - COALESCE(inv.total_available, 0) - COALESCE(po.total_on_order, 0)) * 1.2),
      0
    ) as suggested_order_kg,
    COALESCE(sr.formulas, '[]'::jsonb) as formulas_using,
    COALESCE(sr.dates, '[]'::jsonb) as schedule_dates,
    COALESCE(po.po_numbers, '[]'::jsonb) as pending_po_numbers
  FROM raw_materials rm
  LEFT JOIN scheduled_requirements sr ON sr.raw_material_id = rm.id
  LEFT JOIN inventory_status inv ON inv.raw_material_id = rm.id
  LEFT JOIN pending_orders po ON po.raw_material_id = rm.id
  WHERE sr.total_required IS NOT NULL
    AND NOT rm.is_archived
  ORDER BY 
    -- Priority: items with true shortages first (after considering orders), then by total required
    CASE WHEN COALESCE(sr.total_required, 0) > (COALESCE(inv.total_available, 0) + COALESCE(po.total_on_order, 0)) THEN 0 ELSE 1 END,
    sr.total_required DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;