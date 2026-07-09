-- Update get_material_requirements_by_date_range to include formula names
CREATE OR REPLACE FUNCTION public.get_material_requirements_by_date_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  raw_material_id UUID,
  material_code TEXT,
  material_name TEXT,
  supplier TEXT,
  uom TEXT,
  total_required_kg NUMERIC,
  current_inventory_kg NUMERIC,
  reserved_kg NUMERIC,
  available_kg NUMERIC,
  on_order_kg NUMERIC,
  net_shortage_kg NUMERIC,
  net_after_orders_kg NUMERIC,
  formulas_using JSONB,
  schedule_dates TEXT[],
  pending_po_numbers TEXT[],
  pending_po_details JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH scheduled_production AS (
    SELECT 
      psi.id,
      psi.formula_id,
      f.code as formula_code,
      f.name as formula_name,
      psi.batches,
      ps.schedule_date
    FROM public.production_schedule_items psi
    JOIN public.production_schedules ps ON ps.id = psi.schedule_id
    JOIN public.formulas f ON f.id = psi.formula_id
    WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
      AND NOT f.is_deleted
  ),
  recipe_ingredients AS (
    SELECT 
      sp.id as schedule_item_id,
      sp.formula_code,
      sp.formula_name,
      sp.batches,
      sp.schedule_date,
      rm.id as raw_material_id,
      rm.code as material_code,
      rm.name as material_name,
      rm.supplier,
      rm.uom,
      (COALESCE((recipe->>'weightKg')::NUMERIC, 0) * sp.batches) as required_kg
    FROM scheduled_production sp
    CROSS JOIN LATERAL jsonb_array_elements(
      (SELECT recipe_json FROM public.formulas WHERE id = sp.formula_id)
    ) AS recipe
    JOIN public.raw_materials rm ON LOWER(rm.name) = LOWER(recipe->>'materialName')
    WHERE (recipe->>'weightKg')::NUMERIC > 0
  ),
  material_requirements AS (
    SELECT 
      ri.raw_material_id,
      ri.material_code,
      ri.material_name,
      ri.supplier,
      ri.uom,
      SUM(ri.required_kg) as total_required_kg,
      jsonb_agg(DISTINCT jsonb_build_object(
        'formula_code', ri.formula_code,
        'formula_name', ri.formula_name,
        'batches', ri.batches
      )) as formulas_using,
      array_agg(DISTINCT ri.schedule_date::TEXT ORDER BY ri.schedule_date::TEXT) as schedule_dates
    FROM recipe_ingredients ri
    GROUP BY ri.raw_material_id, ri.material_code, ri.material_name, ri.supplier, ri.uom
  ),
  current_inventory AS (
    SELECT 
      rm.id as raw_material_id,
      COALESCE(SUM(rml.quantity), 0) as current_inventory_kg,
      COALESCE(SUM(rml.qty_reserved_kg), 0) as reserved_kg
    FROM public.raw_materials rm
    LEFT JOIN public.raw_material_lots rml ON rml.raw_material_id = rm.id
    GROUP BY rm.id
  ),
  pending_orders AS (
    SELECT 
      rm.id as raw_material_id,
      COALESCE(SUM(po.quantity), 0) as on_order_kg,
      array_agg(DISTINCT po.po_number ORDER BY po.po_number) FILTER (WHERE po.po_number IS NOT NULL) as pending_po_numbers,
      jsonb_agg(DISTINCT jsonb_build_object(
        'po_number', po.po_number,
        'expected_delivery', po.expected_delivery
      ) ORDER BY (jsonb_build_object(
        'po_number', po.po_number,
        'expected_delivery', po.expected_delivery
      ))) FILTER (WHERE po.po_number IS NOT NULL) as pending_po_details
    FROM public.raw_materials rm
    LEFT JOIN public.purchase_orders po ON LOWER(po.ingredient_name) = LOWER(rm.name)
      AND po.status IN ('ordered', 'in_transit')
    GROUP BY rm.id
  )
  SELECT 
    mr.raw_material_id,
    mr.material_code,
    mr.material_name,
    mr.supplier,
    mr.uom,
    mr.total_required_kg,
    COALESCE(ci.current_inventory_kg, 0) as current_inventory_kg,
    COALESCE(ci.reserved_kg, 0) as reserved_kg,
    GREATEST(COALESCE(ci.current_inventory_kg, 0) - COALESCE(ci.reserved_kg, 0), 0) as available_kg,
    COALESCE(po_data.on_order_kg, 0) as on_order_kg,
    GREATEST(mr.total_required_kg - GREATEST(COALESCE(ci.current_inventory_kg, 0) - COALESCE(ci.reserved_kg, 0), 0), 0) as net_shortage_kg,
    GREATEST(
      mr.total_required_kg - GREATEST(COALESCE(ci.current_inventory_kg, 0) - COALESCE(ci.reserved_kg, 0), 0) - COALESCE(po_data.on_order_kg, 0),
      0
    ) as net_after_orders_kg,
    mr.formulas_using,
    mr.schedule_dates,
    COALESCE(po_data.pending_po_numbers, ARRAY[]::TEXT[]) as pending_po_numbers,
    COALESCE(po_data.pending_po_details, '[]'::JSONB) as pending_po_details
  FROM material_requirements mr
  LEFT JOIN current_inventory ci ON ci.raw_material_id = mr.raw_material_id
  LEFT JOIN pending_orders po_data ON po_data.raw_material_id = mr.raw_material_id
  ORDER BY 
    -- Priority: shortages first, then by shortage amount
    GREATEST(
      mr.total_required_kg - GREATEST(COALESCE(ci.current_inventory_kg, 0) - COALESCE(ci.reserved_kg, 0), 0) - COALESCE(po_data.on_order_kg, 0),
      0
    ) DESC,
    mr.material_code;
END;
$$;