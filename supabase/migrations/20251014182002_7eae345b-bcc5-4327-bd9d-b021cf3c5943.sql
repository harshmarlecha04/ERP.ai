-- Drop the current version and recreate with pending_po_details
DROP FUNCTION IF EXISTS get_material_requirements_by_date_range(text, text);

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
  pending_po_numbers jsonb,
  pending_po_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH scheduled_production AS (
    SELECT 
      psi.formula_id,
      psi.batches,
      ps.schedule_date::text as sched_date,
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
    SELECT 
      sp.formula_code,
      sp.batches,
      sp.sched_date,
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
    SELECT 
      rm.id as mat_id,
      SUM(ri.quantity_per_batch_kg * ri.batches) as total_required,
      array_agg(DISTINCT ri.sched_date ORDER BY ri.sched_date) as dates,
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
    SELECT 
      poi.ingredient_id as po_mat_id,
      SUM(poi.quantity) as total_on_order,
      array_agg(DISTINCT po.po_number ORDER BY po.po_number) as po_numbers,
      jsonb_agg(DISTINCT jsonb_build_object(
        'po_number', po.po_number,
        'expected_delivery', po.expected_delivery::text
      ) ORDER BY jsonb_build_object(
        'po_number', po.po_number,
        'expected_delivery', po.expected_delivery::text
      )) as po_details
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status != 'received'
      AND po.expected_delivery::date <= p_end_date::date
    GROUP BY poi.ingredient_id
  ),
  material_inventory AS (
    SELECT 
      rml.raw_material_id as inv_mat_id,
      SUM(rml.quantity) as total_quantity
    FROM raw_material_lots rml
    GROUP BY rml.raw_material_id
  )
  SELECT 
    rm.id,
    rm.code,
    rm.name,
    rm.supplier,
    rm.uom,
    COALESCE(mr.total_required, 0)::numeric,
    COALESCE(mi.total_quantity, 0)::numeric,
    0::numeric,
    COALESCE(mi.total_quantity, 0)::numeric,
    COALESCE(po.total_on_order, 0)::numeric,
    GREATEST(
      COALESCE(mr.total_required, 0) - COALESCE(mi.total_quantity, 0), 
      0
    )::numeric,
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      COALESCE(mi.total_quantity, 0) - 
      COALESCE(po.total_on_order, 0), 
      0
    )::numeric,
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      COALESCE(mi.total_quantity, 0) - 
      COALESCE(po.total_on_order, 0), 
      0
    )::numeric,
    COALESCE(mr.formulas, '[]'::jsonb),
    COALESCE(to_jsonb(mr.dates), '[]'::jsonb),
    COALESCE(to_jsonb(po.po_numbers), '[]'::jsonb),
    COALESCE(po.po_details, '[]'::jsonb)
  FROM material_requirements mr
  JOIN raw_materials rm ON rm.id = mr.mat_id
  LEFT JOIN pending_orders po ON po.po_mat_id = rm.id
  LEFT JOIN material_inventory mi ON mi.inv_mat_id = rm.id
  WHERE rm.is_archived = false
  ORDER BY 
    GREATEST(
      COALESCE(mr.total_required, 0) - 
      COALESCE(mi.total_quantity, 0) - 
      COALESCE(po.total_on_order, 0), 
      0
    ) DESC, 
    rm.code;
END;
$$;