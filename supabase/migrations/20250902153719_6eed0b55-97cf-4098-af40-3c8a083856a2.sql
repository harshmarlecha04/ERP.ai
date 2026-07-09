CREATE OR REPLACE FUNCTION public.upsert_raw_material_with_lots(p_material jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mat jsonb;
  v_id uuid;
  v_existing_id uuid;
BEGIN
  IF p_material IS NULL THEN
    RAISE EXCEPTION 'p_material required';
  END IF;

  -- Check if this is an update (ID provided) or insert (no ID)
  IF p_material ? 'id' AND (p_material->>'id') IS NOT NULL AND (p_material->>'id') != 'null' THEN
    -- UPDATE MODE: Use the provided ID
    v_id := (p_material->>'id')::uuid;
    
    -- Update existing raw_materials record
    UPDATE public.raw_materials 
    SET code = (p_material->>'code'),
        name = (p_material->>'name'),
        uom = (p_material->>'uom'),
        supplier = NULLIF(p_material->>'supplier',''),
        updated_at = now()
    WHERE id = v_id
    RETURNING to_jsonb(raw_materials.*) INTO v_mat;
    
    IF v_mat IS NULL THEN
      RAISE EXCEPTION 'Material with ID % not found', v_id;
    END IF;
  ELSE
    -- INSERT MODE: Check for duplicate code first
    IF EXISTS (SELECT 1 FROM public.raw_materials WHERE UPPER(code) = UPPER(p_material->>'code')) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_CODE',
        'message', format('RM code "%s" already exists. Use a different code.', p_material->>'code')
      );
    END IF;

    -- Insert new raw material
    INSERT INTO public.raw_materials (code, name, uom, supplier)
    VALUES (
      (p_material->>'code'),
      (p_material->>'name'),
      (p_material->>'uom'),
      NULLIF(p_material->>'supplier','')
    )
    RETURNING to_jsonb(raw_materials.*) INTO v_mat;
    
    v_id := (v_mat->>'id')::uuid;
  END IF;

  -- Handle lots: Fast CTE-based lot sync
  WITH incoming_lots AS (
    SELECT
      CASE 
        WHEN (elem->>'id') IS NOT NULL AND (elem->>'id') != 'null' 
        THEN (elem->>'id')::uuid 
        ELSE gen_random_uuid() 
      END as id,
      v_id as raw_material_id,
      (elem->>'lot_number') as lot_number,
      COALESCE(NULLIF(elem->>'quantity','')::numeric, 0) as quantity,
      COALESCE(NULLIF(elem->>'cost','')::numeric, 0) as cost,
      NULLIF(elem->>'receiving_date','')::date as receiving_date,
      NULLIF(elem->>'expires_on','')::date as expires_on,
      NULLIF(TRIM(elem->>'coa_link'),'') as coa_link
    FROM jsonb_array_elements(COALESCE(p_material->'lots','[]'::jsonb)) elem
  ),
  -- Upsert incoming lots
  upserted_lots AS (
    INSERT INTO public.raw_material_lots AS l (id, raw_material_id, lot_number, quantity, cost, receiving_date, expires_on, coa_link)
    SELECT id, raw_material_id, lot_number, quantity, cost, receiving_date, expires_on, coa_link
    FROM incoming_lots
    ON CONFLICT (id) DO UPDATE
      SET lot_number = EXCLUDED.lot_number,
          quantity = EXCLUDED.quantity,
          cost = EXCLUDED.cost,
          receiving_date = EXCLUDED.receiving_date,
          expires_on = EXCLUDED.expires_on,
          coa_link = EXCLUDED.coa_link,
          updated_at = now()
    RETURNING l.*
  )
  -- Delete lots that are no longer in the payload
  DELETE FROM public.raw_material_lots l
  WHERE l.raw_material_id = v_id
    AND NOT EXISTS (
      SELECT 1 FROM incoming_lots il 
      WHERE il.id = l.id
    );

  -- Return complete material with lots
  RETURN (
    SELECT to_jsonb(m.*)
           || jsonb_build_object('lots', COALESCE(
                (SELECT jsonb_agg(to_jsonb(l.*) ORDER BY l.lot_number NULLS LAST, l.receiving_date NULLS LAST)
                 FROM public.raw_material_lots l WHERE l.raw_material_id = m.id),
                '[]'::jsonb
              ))
    FROM public.raw_materials m
    WHERE m.id = v_id
  );
END
$function$;