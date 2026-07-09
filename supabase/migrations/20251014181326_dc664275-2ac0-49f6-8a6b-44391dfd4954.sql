-- Fix the material requirements function with correct column names
DROP FUNCTION IF EXISTS get_material_requirements_by_date_range(text, text);

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
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH scheduled_production AS (
    -- Get all scheduled production items in the date range
    SELECT 
      psi.formula_id,
      psi.batches,
      ps.schedule_date::text,
      f.code as formula_code,
      f.recipe_json
    FROM production_schedule_items psi
    JOIN production_schedules ps ON psi.schedule_id = ps.id
    JOIN formulas f ON f.id = psi.formula_id
    WHERE ps.schedule_date::date >= p_start_date::date
      AND ps.schedule_date::date <= p_end_date::date
      AND f.is_deleted = false
  ),
  recipe_ingredients AS (
    -- Extract ingredients from recipe_json for each scheduled production
    SELECT 
      sp.formula_code,
      sp.batches,
      sp.schedule_date,
      ingredient->>'materialName' as material_name,
      COALESCE(
        (ingredient->>'qty_per_batch_kg')::numeric,
        (ingredient->>'weightKg')::numeric,
        0
      ) as quantity_per_batch_kg
    FROM scheduled_production sp,
    jsonb_array_elements(sp.recipe_json) as ingredient
    WHERE ingredient->>'materialName' IS NOT NULL
  ),
  material_requirements AS (
    -- Match ingredients to raw materials and calculate totals
    SELECT 
      rm.id as raw_material_id,
      SUM(ri.quantity_per_batch_kg * ri.batches) as total_required,
      array_agg(DISTINCT ri.schedule_date ORDER BY ri.schedule_date) as dates,
      jsonb_agg(DISTINCT jsonb_build_object(
        'formula_code', ri.formula_code, 
        'batches', ri.batches
      )) as formulas
    FROM recipe_ingredients ri
    JOIN raw_materials rm ON LOWER(rm.name) = LOWER(ri.material_name)
    WHERE rm.is_archived = false
    GROUP BY rm.id
  ),
  pending_orders AS (
    -- Get pending purchase orders for each material (using ingredient_id)
    SELECT 
      poi.ingredient_id as raw_material_id,
      SUM(poi.quantity) as total_on_order,
      array_agg(DISTINCT po.po_number) as po_numbers
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status != 'received'
      AND po.expected_delivery::date <= p_end_date::date
    GROUP BY poi.ingredient_id
  ),
  material_inventory AS (
    -- Calculate current inventory from lots
    SELECT 
      raw_material_id,
      SUM(quantity) as total_quantity
    FROM raw_material_lots
    GROUP BY raw_material_id
  )
  SELECT 
    rm.id as raw_material_id,
    rm.code as material_code,
    rm.name as material_name,
    rm.supplier,
    rm.uom,
    COALESCE(mr.total_required, 0)::numeric as total_required_kg,
    COALESCE(mi.total_quantity, 0)::numeric as current_inventory_kg,
    0::numeric as reserved_kg,
    COALESCE(mi.total_quantity, 0)::numeric as available_kg,
    COALESCE(po.total_on_order, 0)::numeric as on_order_kg,
    GREATEST(
      COALESCE(mr.total_required, 0) - COALESCE(mi.total_quantity, 0), 
      0
    )::numeric as net_shortage_kg,
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      COALESCE(mi.total_quantity, 0) - 
      COALESCE(po.total_on_order, 0), 
      0
    )::numeric as net_after_orders_kg,
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      COALESCE(mi.total_quantity, 0) - 
      COALESCE(po.total_on_order, 0), 
      0
    )::numeric as suggested_order_kg,
    COALESCE(mr.formulas, '[]'::jsonb) as formulas_using,
    COALESCE(to_jsonb(mr.dates), '[]'::jsonb) as schedule_dates,
    COALESCE(to_jsonb(po.po_numbers), '[]'::jsonb) as pending_po_numbers
  FROM material_requirements mr
  JOIN raw_materials rm ON rm.id = mr.raw_material_id
  LEFT JOIN pending_orders po ON po.raw_material_id = rm.id
  LEFT JOIN material_inventory mi ON mi.raw_material_id = rm.id
  WHERE rm.is_archived = false
  ORDER BY net_after_orders_kg DESC, material_code;
END;
$$;