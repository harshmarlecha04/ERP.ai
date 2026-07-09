-- Drop and recreate get_material_requirements_by_date_range to fix on-order quantity calculation
-- This fixes the issue where on-order quantities were not showing because the function
-- was joining on purchase_orders.ingredient_name (which is often NULL) instead of 
-- joining through purchase_order_items where the actual ingredient data is stored

DROP FUNCTION IF EXISTS public.get_material_requirements_by_date_range(date, date);

CREATE OR REPLACE FUNCTION public.get_material_requirements_by_date_range(
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
  formulas_using jsonb,
  schedule_dates text[],
  pending_po_numbers text[],
  pending_po_details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH schedule_items AS (
    SELECT 
      psi.id,
      psi.formula_id,
      psi.batches,
      ps.schedule_date,
      f.code as formula_code,
      f.name as formula_name,
      f.recipe_json
    FROM production_schedule_items psi
    JOIN production_schedules ps ON ps.id = psi.schedule_id
    JOIN formulas f ON f.id = psi.formula_id
    WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
      AND NOT f.is_deleted
  ),
  
  material_usage AS (
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
      COALESCE(
        (recipe_item.value->>'weightKg')::numeric,
        0
      ) * si.batches as required_kg
    FROM schedule_items si
    CROSS JOIN LATERAL jsonb_array_elements(si.recipe_json) AS recipe_item
    JOIN raw_materials rm ON LOWER(rm.name) = LOWER(recipe_item.value->>'materialName')
    WHERE NOT rm.is_archived
      AND recipe_item.value->>'materialName' IS NOT NULL
      AND COALESCE((recipe_item.value->>'weightKg')::numeric, 0) > 0
  ),
  
  material_summary AS (
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
      array_agg(DISTINCT schedule_date::text ORDER BY schedule_date::text) as schedule_dates
    FROM material_usage
    GROUP BY raw_material_id, material_code, material_name, supplier, uom
  ),
  
  inventory_summary AS (
    SELECT 
      rm.id as raw_material_id,
      COALESCE(SUM(rml.quantity), 0) as current_inventory_kg,
      COALESCE(SUM(rml.qty_reserved_kg), 0) as reserved_kg
    FROM raw_materials rm
    LEFT JOIN raw_material_lots rml ON rml.raw_material_id = rm.id
    WHERE NOT rm.is_archived
    GROUP BY rm.id
  ),
  
  purchase_orders_summary AS (
    SELECT 
      rm.id as raw_material_id,
      COALESCE(SUM(poi.quantity), 0) as on_order_kg,
      array_agg(DISTINCT po.po_number ORDER BY po.po_number) FILTER (WHERE po.po_number IS NOT NULL) as pending_po_numbers,
      jsonb_agg(DISTINCT jsonb_build_object(
        'po_number', po.po_number,
        'expected_delivery', po.expected_delivery::text
      )) FILTER (WHERE po.po_number IS NOT NULL) as pending_po_details
    FROM raw_materials rm
    LEFT JOIN purchase_order_items poi ON LOWER(poi.ingredient_name) = LOWER(rm.name)
    LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
      AND po.status = 'ordered'
      AND po.expected_delivery >= CURRENT_DATE
    WHERE NOT rm.is_archived
    GROUP BY rm.id
  )
  
  SELECT 
    ms.raw_material_id,
    ms.material_code,
    ms.material_name,
    ms.supplier,
    ms.uom,
    ms.total_required_kg,
    COALESCE(inv.current_inventory_kg, 0) as current_inventory_kg,
    COALESCE(inv.reserved_kg, 0) as reserved_kg,
    COALESCE(inv.current_inventory_kg, 0) - COALESCE(inv.reserved_kg, 0) as available_kg,
    COALESCE(po.on_order_kg, 0) as on_order_kg,
    GREATEST(
      ms.total_required_kg - (COALESCE(inv.current_inventory_kg, 0) - COALESCE(inv.reserved_kg, 0)),
      0
    ) as net_shortage_kg,
    ms.total_required_kg - (COALESCE(inv.current_inventory_kg, 0) - COALESCE(inv.reserved_kg, 0)) - COALESCE(po.on_order_kg, 0) as net_after_orders_kg,
    ms.formulas_using,
    ms.schedule_dates,
    COALESCE(po.pending_po_numbers, ARRAY[]::text[]) as pending_po_numbers,
    COALESCE(po.pending_po_details, '[]'::jsonb) as pending_po_details
  FROM material_summary ms
  LEFT JOIN inventory_summary inv ON inv.raw_material_id = ms.raw_material_id
  LEFT JOIN purchase_orders_summary po ON po.raw_material_id = ms.raw_material_id
  ORDER BY ms.material_name;
END;
$$;