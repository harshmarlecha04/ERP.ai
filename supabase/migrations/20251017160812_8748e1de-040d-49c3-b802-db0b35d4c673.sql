-- Fix search_path security warnings for newly created functions

-- Update find_raw_material_by_name with search_path
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='find_raw_material_by_name' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.find_raw_material_by_name(
  p_recipe_material_name TEXT
) RETURNS UUID 
LANGUAGE plpgsql 
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_material_id UUID;
BEGIN
  -- Tier 1: Exact match (fastest)
  SELECT id INTO v_material_id
  FROM public.raw_materials
  WHERE LOWER(name) = LOWER(p_recipe_material_name)
  LIMIT 1;
  
  IF v_material_id IS NOT NULL THEN
    RETURN v_material_id;
  END IF;
  
  -- Tier 2: Partial match (recipe name contained in material name)
  SELECT id INTO v_material_id
  FROM public.raw_materials
  WHERE LOWER(name) LIKE '%' || LOWER(p_recipe_material_name) || '%'
  ORDER BY length(name) ASC
  LIMIT 1;
  
  IF v_material_id IS NOT NULL THEN
    RETURN v_material_id;
  END IF;
  
  -- Tier 3: Fuzzy match using similarity
  SELECT id INTO v_material_id
  FROM public.raw_materials
  WHERE similarity(LOWER(name), LOWER(p_recipe_material_name)) > 0.4
  ORDER BY similarity(LOWER(name), LOWER(p_recipe_material_name)) DESC
  LIMIT 1;
  
  RETURN v_material_id;
END;
$$;

-- Update get_material_requirements_by_date_range with search_path
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_material_requirements_by_date_range' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
SET search_path TO 'public'
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
    CROSS JOIN LATERAL (
      SELECT * FROM public.raw_materials 
      WHERE id = public.find_raw_material_by_name(recipe->>'materialName')
    ) AS rm
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
    GREATEST(
      mr.total_required_kg - GREATEST(COALESCE(ci.current_inventory_kg, 0) - COALESCE(ci.reserved_kg, 0), 0) - COALESCE(po_data.on_order_kg, 0),
      0
    ) DESC,
    mr.material_code;
END;
$$;

-- Update get_unmatched_recipe_materials with search_path
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_unmatched_recipe_materials' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_unmatched_recipe_materials(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  formula_code TEXT,
  formula_name TEXT,
  recipe_material_name TEXT,
  suggested_matches JSONB
) 
LANGUAGE plpgsql 
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH scheduled_production AS (
    SELECT 
      f.code as formula_code,
      f.name as formula_name,
      f.recipe_json
    FROM public.production_schedule_items psi
    JOIN public.production_schedules ps ON ps.id = psi.schedule_id
    JOIN public.formulas f ON f.id = psi.formula_id
    WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
      AND NOT f.is_deleted
  )
  SELECT DISTINCT
    sp.formula_code,
    sp.formula_name,
    recipe->>'materialName' as recipe_material_name,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'name', rm.name,
        'code', rm.code,
        'similarity', similarity(LOWER(rm.name), LOWER(recipe->>'materialName'))
      ))
      FROM public.raw_materials rm
      ORDER BY similarity(LOWER(rm.name), LOWER(recipe->>'materialName')) DESC
      LIMIT 3
    ) as suggested_matches
  FROM scheduled_production sp
  CROSS JOIN LATERAL jsonb_array_elements(sp.recipe_json) AS recipe
  WHERE public.find_raw_material_by_name(recipe->>'materialName') IS NULL;
END;
$$;