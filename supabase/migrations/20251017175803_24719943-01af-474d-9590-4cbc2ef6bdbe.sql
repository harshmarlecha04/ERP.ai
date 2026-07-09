-- Comprehensive fix for all ambiguous column references in get_material_requirements_by_date_range
-- This resolves conflicts between RETURNS TABLE variables and CTE column aliases

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_material_requirements_by_date_range' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH production_items AS (
    SELECT 
      psi.id as schedule_item_id,
      psi.formula_id,
      psi.batches,
      ps.schedule_date,
      f.code as formula_code,
      f.name as formula_name,
      f.recipe_json
    FROM public.production_schedule_items psi
    JOIN public.production_schedules ps ON ps.id = psi.schedule_id
    JOIN public.formulas f ON f.id = psi.formula_id
    WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
      AND NOT f.is_deleted
  ),
  material_usage AS (
    SELECT 
      pi.schedule_item_id,
      pi.formula_id,
      pi.formula_code,
      pi.formula_name,
      pi.batches,
      pi.schedule_date,
      rm.id as mat_raw_material_id,
      rm.code as mat_code,
      rm.name as mat_name,
      rm.supplier as mat_supplier,
      rm.uom as mat_uom,
      (recipe_item.value->>'weightKg')::numeric * pi.batches as required_kg
    FROM production_items pi
    CROSS JOIN LATERAL jsonb_array_elements(pi.recipe_json) as recipe_item
    JOIN public.raw_materials rm ON LOWER(rm.name) = LOWER(recipe_item.value->>'materialName')
    WHERE (recipe_item.value->>'weightKg')::numeric > 0
  ),
  material_summary AS (
    SELECT 
      mat_raw_material_id,
      mat_code,
      mat_name,
      mat_supplier,
      mat_uom,
      SUM(required_kg) as total_required_kg,
      jsonb_agg(
        jsonb_build_object(
          'formula_code', formula_code,
          'formula_name', formula_name,
          'batches', batches
        )
        ORDER BY schedule_date, formula_code
      ) as formulas_using,
      array_agg(DISTINCT schedule_date::text ORDER BY schedule_date::text) as schedule_dates
    FROM material_usage
    GROUP BY mat_raw_material_id, mat_code, mat_name, mat_supplier, mat_uom
  ),
  inventory_summary AS (
    SELECT 
      rml.raw_material_id as inv_raw_material_id,
      COALESCE(SUM(rml.quantity), 0) as current_inventory_kg,
      COALESCE(SUM(rml.qty_reserved_kg), 0) as reserved_kg
    FROM public.raw_material_lots rml
    GROUP BY rml.raw_material_id
  ),
  purchase_orders_summary AS (
    SELECT 
      poi.ingredient_id as po_raw_material_id,
      COALESCE(SUM(poi.quantity), 0) as on_order_kg,
      array_agg(DISTINCT po.po_number ORDER BY po.po_number) 
        FILTER (WHERE po.status IN ('ordered', 'in_transit')) as pending_po_numbers,
      jsonb_agg(
        jsonb_build_object(
          'po_number', po.po_number,
          'expected_delivery', po.expected_delivery::text
        )
        ORDER BY po.expected_delivery
      ) FILTER (WHERE po.status IN ('ordered', 'in_transit')) as pending_po_details
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status IN ('ordered', 'in_transit')
    GROUP BY poi.ingredient_id
  )
  SELECT 
    ms.mat_raw_material_id as raw_material_id,
    ms.mat_code as material_code,
    ms.mat_name as material_name,
    ms.mat_supplier as supplier,
    ms.mat_uom as uom,
    ms.total_required_kg,
    COALESCE(inv.current_inventory_kg, 0) as current_inventory_kg,
    COALESCE(inv.reserved_kg, 0) as reserved_kg,
    GREATEST(COALESCE(inv.current_inventory_kg, 0) - COALESCE(inv.reserved_kg, 0), 0) as available_kg,
    COALESCE(po.on_order_kg, 0) as on_order_kg,
    GREATEST(
      ms.total_required_kg - GREATEST(COALESCE(inv.current_inventory_kg, 0) - COALESCE(inv.reserved_kg, 0), 0),
      0
    ) as net_shortage_kg,
    (
      GREATEST(COALESCE(inv.current_inventory_kg, 0) - COALESCE(inv.reserved_kg, 0), 0) +
      COALESCE(po.on_order_kg, 0) -
      ms.total_required_kg
    ) as net_after_orders_kg,
    ms.formulas_using,
    ms.schedule_dates,
    COALESCE(po.pending_po_numbers, ARRAY[]::text[]) as pending_po_numbers,
    COALESCE(po.pending_po_details, '[]'::jsonb) as pending_po_details
  FROM material_summary ms
  LEFT JOIN inventory_summary inv ON inv.inv_raw_material_id = ms.mat_raw_material_id
  LEFT JOIN purchase_orders_summary po ON po.po_raw_material_id = ms.mat_raw_material_id
  ORDER BY ms.mat_name;
END;
$$;