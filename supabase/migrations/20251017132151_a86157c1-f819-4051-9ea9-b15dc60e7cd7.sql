-- Function to get alternative materials (same ingredient, different vendors)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_material_alternatives' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_material_alternatives(p_material_id uuid)
RETURNS TABLE (
  alternative_id uuid,
  material_code text,
  material_name text,
  supplier text,
  available_qty numeric,
  uom text,
  lot_count integer,
  lots jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_material_name text;
BEGIN
  -- Get the name of the material we're finding alternatives for
  SELECT name INTO v_material_name
  FROM public.raw_materials
  WHERE id = p_material_id;
  
  IF v_material_name IS NULL THEN
    RETURN;
  END IF;
  
  -- Find all other materials with the same name (case-insensitive)
  -- but different ID (i.e., different vendors)
  RETURN QUERY
  SELECT 
    rm.id as alternative_id,
    rm.code as material_code,
    rm.name as material_name,
    rm.supplier,
    COALESCE(SUM(rml.quantity), 0) as available_qty,
    rm.uom,
    COUNT(rml.id)::integer as lot_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'lot_id', rml.id,
          'lot_number', rml.lot_number,
          'quantity', rml.quantity,
          'cost', rml.cost,
          'receiving_date', rml.receiving_date,
          'expires_on', rml.expires_on
        ) ORDER BY rml.receiving_date DESC NULLS LAST, rml.created_at DESC
      ) FILTER (WHERE rml.id IS NOT NULL),
      '[]'::jsonb
    ) as lots
  FROM public.raw_materials rm
  LEFT JOIN public.raw_material_lots rml ON rml.raw_material_id = rm.id
  WHERE LOWER(rm.name) = LOWER(v_material_name)
    AND rm.id != p_material_id
    AND (rm.is_archived = false OR rm.is_archived IS NULL)
  GROUP BY rm.id, rm.code, rm.name, rm.supplier, rm.uom
  HAVING COALESCE(SUM(rml.quantity), 0) > 0
  ORDER BY available_qty DESC;
END;
$$;