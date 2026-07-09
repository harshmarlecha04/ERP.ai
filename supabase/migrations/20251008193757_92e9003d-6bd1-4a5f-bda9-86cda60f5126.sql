-- Create Material Requirements Planning function
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
  net_shortage_kg numeric,
  suggested_order_kg numeric,
  formulas_using jsonb,
  schedule_dates jsonb
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
    GREATEST(COALESCE(sr.total_required, 0) - COALESCE(inv.total_available, 0), 0) as net_shortage_kg,
    -- Suggested order: shortage + 20% safety stock
    GREATEST(
      CEILING((COALESCE(sr.total_required, 0) - COALESCE(inv.total_available, 0)) * 1.2),
      0
    ) as suggested_order_kg,
    COALESCE(sr.formulas, '[]'::jsonb) as formulas_using,
    COALESCE(sr.dates, '[]'::jsonb) as schedule_dates
  FROM raw_materials rm
  LEFT JOIN scheduled_requirements sr ON sr.raw_material_id = rm.id
  LEFT JOIN inventory_status inv ON inv.raw_material_id = rm.id
  WHERE sr.total_required IS NOT NULL
    AND NOT rm.is_archived
  ORDER BY 
    -- Priority: items with shortages first, then by total required
    CASE WHEN COALESCE(sr.total_required, 0) > COALESCE(inv.total_available, 0) THEN 0 ELSE 1 END,
    sr.total_required DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;