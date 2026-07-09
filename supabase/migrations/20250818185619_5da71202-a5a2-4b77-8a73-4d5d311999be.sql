-- Drop existing unique constraint that only includes lot_number
ALTER TABLE public.raw_material_lots 
DROP CONSTRAINT IF EXISTS raw_material_lots_raw_material_id_lot_number_key;

-- Add new unique constraint that includes receiving_date to allow same lot_number with different receiving_date
ALTER TABLE public.raw_material_lots DROP CONSTRAINT IF EXISTS raw_material_lots_raw_material_id_lot_number_receiving_date_key;
ALTER TABLE public.raw_material_lots 
ADD CONSTRAINT raw_material_lots_raw_material_id_lot_number_receiving_date_key 
UNIQUE (raw_material_id, lot_number, receiving_date);

-- Update the upsert function to handle the new uniqueness constraint
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='upsert_raw_material_with_lots' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.upsert_raw_material_with_lots(p_material jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Fast CTE-based lot sync with new uniqueness constraint
  WITH incoming_lots AS (
    SELECT
      COALESCE((elem->>'id')::uuid, gen_random_uuid()) as id,
      v_id as raw_material_id,
      (elem->>'lot_number') as lot_number,
      COALESCE(NULLIF(elem->>'quantity','')::numeric, 0) as quantity,
      COALESCE(NULLIF(elem->>'cost','')::numeric, 0) as cost,
      NULLIF(elem->>'receiving_date','')::date as receiving_date,
      NULLIF(elem->>'expires_on','')::date as expires_on,
      NULLIF(TRIM(elem->>'coa_link'),'') as coa_link
    FROM jsonb_array_elements(COALESCE(p_material->'lots','[]'::jsonb)) elem
  ),
  -- Upsert incoming lots using the new unique constraint (raw_material_id, lot_number, receiving_date)
  upserted_lots AS (
    INSERT INTO public.raw_material_lots AS l (id, raw_material_id, lot_number, quantity, cost, receiving_date, expires_on, coa_link)
    SELECT id, raw_material_id, lot_number, quantity, cost, receiving_date, expires_on, coa_link
    FROM incoming_lots
    ON CONFLICT (raw_material_id, lot_number, receiving_date) DO UPDATE
      SET quantity = EXCLUDED.quantity,
          cost = EXCLUDED.cost,
          expires_on = EXCLUDED.expires_on,
          coa_link = EXCLUDED.coa_link,
          updated_at = now()
    RETURNING l.*
  )
  -- Only delete lots that are no longer in the payload (based on the unique combination)
  DELETE FROM public.raw_material_lots l
  WHERE l.raw_material_id = v_id
    AND NOT EXISTS (
      SELECT 1 FROM incoming_lots il 
      WHERE il.raw_material_id = l.raw_material_id 
      AND COALESCE(il.lot_number, '') = COALESCE(l.lot_number, '')
      AND COALESCE(il.receiving_date, '1900-01-01'::date) = COALESCE(l.receiving_date, '1900-01-01'::date)
    );

  -- Return complete material with lots
  RETURN (
    SELECT to_jsonb(m.*)
           || jsonb_build_object('lots', COALESCE(
                (SELECT jsonb_agg(to_jsonb(l.*) ORDER BY l.lot_number, l.receiving_date)
                 FROM public.raw_material_lots l WHERE l.raw_material_id = m.id),
                '[]'::jsonb
              ))
    FROM public.raw_materials m
    WHERE m.id = v_id
  );
END
$function$;