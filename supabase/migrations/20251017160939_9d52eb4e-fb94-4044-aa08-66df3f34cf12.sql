-- Fix security warning: Set search_path for find_raw_material_by_name
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
  ORDER BY length(name) ASC -- Prefer shorter (more specific) matches
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

-- Fix security warning: Set search_path for get_unmatched_recipe_materials
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