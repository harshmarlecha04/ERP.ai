-- Add case-insensitive unique constraint on code
CREATE EXTENSION IF NOT EXISTS citext;

-- Add generated column for case-insensitive code matching
ALTER TABLE raw_materials 
ADD COLUMN IF NOT EXISTS code_ci citext GENERATED ALWAYS AS (code::citext) STORED;

-- Create unique index on case-insensitive code
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_materials_code_unique_ci 
ON raw_materials (code_ci);

-- Update column name (raw_material_lots already has expires_on based on the error)
-- Check if uom column exists, if not rename from unit_of_measure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'raw_materials' AND column_name = 'unit_of_measure') THEN
        ALTER TABLE raw_materials RENAME COLUMN unit_of_measure TO uom;
    END IF;
END $$;

-- Create atomic upsert function
CREATE OR REPLACE FUNCTION public.upsert_raw_material_with_lots(p_material jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mat jsonb;
  v_id uuid;
BEGIN
  IF p_material IS NULL THEN
    RAISE EXCEPTION 'p_material required';
  END IF;

  -- Upsert raw_materials (atomic)
  INSERT INTO public.raw_materials AS rm (id, code, name, uom, supplier)
  VALUES (
    COALESCE((p_material->>'id')::uuid, gen_random_uuid()),
    (p_material->>'code'),
    (p_material->>'name'),
    (p_material->>'uom'),
    NULLIF(p_material->>'supplier','')
  )
  ON CONFLICT (code_ci) DO UPDATE
    SET name = EXCLUDED.name,
        uom = EXCLUDED.uom,
        supplier = EXCLUDED.supplier,
        updated_at = now()
  RETURNING to_jsonb(rm.*) INTO v_mat;

  v_id := (v_mat->>'id')::uuid;

  -- Sync lots: upsert provided, delete removed
  CREATE TEMPORARY TABLE _incoming_lots ON COMMIT DROP
  AS
  SELECT
    COALESCE((elem->>'id')::uuid, gen_random_uuid()) as id,
    v_id as raw_material_id,
    (elem->>'lot_number') as lot_number,
    (elem->>'quantity')::numeric as quantity,
    COALESCE((elem->>'cost')::numeric,0) as cost,
    NULLIF(elem->>'expires_on','')::date as expires_on
  FROM jsonb_array_elements(COALESCE(p_material->'lots','[]'::jsonb)) elem;

  -- Upsert incoming lots
  INSERT INTO public.raw_material_lots AS l (id, raw_material_id, lot_number, quantity, cost, expires_on)
  SELECT id, raw_material_id, lot_number, quantity, cost, expires_on
  FROM _incoming_lots
  ON CONFLICT (id) DO UPDATE
    SET lot_number = EXCLUDED.lot_number,
        quantity = EXCLUDED.quantity,
        cost = EXCLUDED.cost,
        expires_on = EXCLUDED.expires_on,
        updated_at = now();

  -- Delete lots no longer in payload
  DELETE FROM public.raw_material_lots l
  WHERE l.raw_material_id = v_id
    AND NOT EXISTS (SELECT 1 FROM _incoming_lots i WHERE i.id = l.id);

  -- Return complete material with lots
  RETURN (
    SELECT to_jsonb(m.*)
           || jsonb_build_object('lots', COALESCE(
                (SELECT jsonb_agg(to_jsonb(l.*) ORDER BY l.lot_number)
                 FROM public.raw_material_lots l WHERE l.raw_material_id = m.id),
                '[]'::jsonb
              ))
    FROM public.raw_materials m
    WHERE m.id = v_id
  );
END
$$;