-- Improve material alternatives matching to handle similar names
-- This allows finding alternatives even when names differ slightly (e.g., with/without supplier suffix)

DROP FUNCTION IF EXISTS public.get_material_alternatives(uuid);

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
  v_base_name text;
BEGIN
  -- Get the name of the material we're finding alternatives for
  SELECT name INTO v_material_name
  FROM public.raw_materials
  WHERE id = p_material_id;
  
  IF v_material_name IS NULL THEN
    RETURN;
  END IF;
  
  -- Extract base name (remove common suffixes like supplier names)
  v_base_name := TRIM(REGEXP_REPLACE(v_material_name, '\s+(from|by|-)\s+.*$', '', 'i'));
  
  -- Find materials using flexible matching:
  -- 1. Exact match (case-insensitive)
  -- 2. One name contains the other (for variations like "X" vs "X from Supplier")
  -- 3. Base name similarity
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
  WHERE rm.id != p_material_id
    AND (rm.is_archived = false OR rm.is_archived IS NULL)
    AND (
      -- Exact match
      LOWER(rm.name) = LOWER(v_material_name)
      -- Or one name contains the other (partial match)
      OR LOWER(rm.name) LIKE '%' || LOWER(v_material_name) || '%'
      OR LOWER(v_material_name) LIKE '%' || LOWER(rm.name) || '%'
      -- Or base names match (ignoring supplier suffixes)
      OR LOWER(TRIM(REGEXP_REPLACE(rm.name, '\s+(from|by|-)\s+.*$', '', 'i'))) = LOWER(v_base_name)
    )
  GROUP BY rm.id, rm.code, rm.name, rm.supplier, rm.uom
  HAVING COALESCE(SUM(rml.quantity), 0) > 0
  ORDER BY 
    -- Prioritize exact matches first
    CASE WHEN LOWER(rm.name) = LOWER(v_material_name) THEN 0 ELSE 1 END,
    available_qty DESC;
END;
$$;