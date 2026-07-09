-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_material_requirements_by_date_range(text, text);

-- Create function to get material requirements for a date range
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_material_requirements_by_date_range' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION get_material_requirements_by_date_range(
  p_start_date text,
  p_end_date text
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
  suggested_order_kg numeric,
  formulas_using jsonb,
  schedule_dates jsonb,
  pending_po_numbers jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH scheduled_production AS (
    -- Get all scheduled production items in the date range
    SELECT 
      psi.formula_id,
      psi.batches,
      ps.schedule_date::text
    FROM production_schedule_items psi
    JOIN production_schedules ps ON psi.schedule_id = ps.id
    WHERE ps.schedule_date::date >= p_start_date::date
      AND ps.schedule_date::date <= p_end_date::date
  ),
  formula_ingredients AS (
    -- Get all ingredients needed for scheduled formulas
    SELECT 
      fi.raw_material_id,
      fi.quantity_kg,
      sp.batches,
      sp.schedule_date,
      f.formula_code
    FROM scheduled_production sp
    JOIN formula_ingredients fi ON fi.formula_id = sp.formula_id
    JOIN formulas f ON f.id = sp.formula_id
  ),
  material_requirements AS (
    -- Calculate total requirements per material
    SELECT 
      fi.raw_material_id,
      SUM(fi.quantity_kg * fi.batches) as total_required,
      array_agg(DISTINCT fi.schedule_date ORDER BY fi.schedule_date) as dates,
      jsonb_agg(DISTINCT jsonb_build_object('formula_code', fi.formula_code, 'batches', fi.batches)) as formulas
    FROM formula_ingredients fi
    GROUP BY fi.raw_material_id
  ),
  pending_orders AS (
    -- Get pending purchase orders for each material
    SELECT 
      poi.raw_material_id,
      SUM(poi.quantity_kg) as total_on_order,
      array_agg(DISTINCT po.po_number) as po_numbers
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status != 'received'
      AND po.expected_date::date >= p_start_date::date
      AND po.expected_date::date <= p_end_date::date
    GROUP BY poi.raw_material_id
  )
  SELECT 
    rm.id as raw_material_id,
    rm.material_code,
    rm.name as material_name,
    v.name as supplier,
    rm.uom,
    COALESCE(mr.total_required, 0)::numeric as total_required_kg,
    COALESCE(rm.quantity_kg, 0)::numeric as current_inventory_kg,
    COALESCE(rm.reserved_quantity_kg, 0)::numeric as reserved_kg,
    (COALESCE(rm.quantity_kg, 0) - COALESCE(rm.reserved_quantity_kg, 0))::numeric as available_kg,
    COALESCE(po.total_on_order, 0)::numeric as on_order_kg,
    GREATEST(COALESCE(mr.total_required, 0) - (COALESCE(rm.quantity_kg, 0) - COALESCE(rm.reserved_quantity_kg, 0)), 0)::numeric as net_shortage_kg,
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      (COALESCE(rm.quantity_kg, 0) - COALESCE(rm.reserved_quantity_kg, 0)) - 
      COALESCE(po.total_on_order, 0), 
      0
    )::numeric as net_after_orders_kg,
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      (COALESCE(rm.quantity_kg, 0) - COALESCE(rm.reserved_quantity_kg, 0)) - 
      COALESCE(po.total_on_order, 0), 
      0
    )::numeric as suggested_order_kg,
    COALESCE(mr.formulas, '[]'::jsonb) as formulas_using,
    COALESCE(to_jsonb(mr.dates), '[]'::jsonb) as schedule_dates,
    COALESCE(to_jsonb(po.po_numbers), '[]'::jsonb) as pending_po_numbers
  FROM material_requirements mr
  JOIN raw_materials rm ON rm.id = mr.raw_material_id
  LEFT JOIN vendors v ON v.id = rm.vendor_id
  LEFT JOIN pending_orders po ON po.raw_material_id = rm.id
  ORDER BY net_after_orders_kg DESC, material_code;
END;
$$;