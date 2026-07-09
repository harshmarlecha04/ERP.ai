-- Add idempotency key column for create operations
ALTER TABLE public.raw_materials 
ADD COLUMN IF NOT EXISTS idempotency_key UUID DEFAULT NULL;

-- Create case-insensitive unique index for faster duplicate checks (non-concurrent)
DROP INDEX IF EXISTS idx_raw_materials_code_unique_ci;
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_materials_code_unique_ci 
ON public.raw_materials (UPPER(code));

-- Create index on idempotency key for fast lookups
CREATE INDEX IF NOT EXISTS idx_raw_materials_idempotency_key 
ON public.raw_materials (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Add optimized indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_materials_updated_at 
ON public.raw_materials (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_material_lots_material_id 
ON public.raw_material_lots (raw_material_id);

-- Create optimized RPC function with idempotency support
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='create_raw_material_with_lots_v2' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.create_raw_material_with_lots_v2(
  p_code text,
  p_name text,
  p_supplier text DEFAULT NULL,
  p_unit_of_measure text DEFAULT 'kg',
  p_lots jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_material_id uuid;
  v_existing_material record;
  v_lots_array jsonb := '[]'::jsonb;
  v_lot_data jsonb;
  v_lot_insert_data jsonb[];
BEGIN
  -- Check for existing operation with same idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_material 
    FROM public.raw_materials 
    WHERE idempotency_key = p_idempotency_key;
    
    IF FOUND THEN
      -- Return existing material with lots
      SELECT jsonb_agg(to_jsonb(l.*)) INTO v_lots_array
      FROM public.raw_material_lots l 
      WHERE l.raw_material_id = v_existing_material.id;
      
      RETURN jsonb_build_object(
        'success', true,
        'material', to_jsonb(v_existing_material),
        'lots', COALESCE(v_lots_array, '[]'::jsonb)
      );
    END IF;
  END IF;

  -- Check for duplicate code (case insensitive, fast lookup using index)
  IF EXISTS (SELECT 1 FROM public.raw_materials WHERE UPPER(code) = UPPER(p_code)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_CODE',
      'message', format('RM code "%s" already exists. Use a different code.', p_code)
    );
  END IF;

  -- Insert raw material with idempotency key
  INSERT INTO public.raw_materials (code, name, supplier, unit_of_measure, idempotency_key)
  VALUES (p_code, p_name, p_supplier, p_unit_of_measure, p_idempotency_key)
  RETURNING * INTO v_existing_material;

  v_material_id := v_existing_material.id;

  -- Bulk insert lots if provided (much faster than individual inserts)
  IF jsonb_array_length(p_lots) > 0 THEN
    -- Single bulk insert operation - fastest approach
    INSERT INTO public.raw_material_lots (
      raw_material_id, lot_number, quantity, cost, expiry_date, coa_link
    )
    SELECT 
      v_material_id,
      NULLIF(trim(lot_data->>'lot_number'), ''),
      COALESCE((lot_data->>'quantity')::numeric, 0),
      COALESCE((lot_data->>'cost')::numeric, 0),
      NULLIF(lot_data->>'expiry_date', '')::date,
      NULLIF(trim(lot_data->>'coa_link'), '')
    FROM jsonb_array_elements(p_lots) AS lot_data;

    -- Get inserted lots for response
    SELECT jsonb_agg(to_jsonb(l.*)) INTO v_lots_array
    FROM public.raw_material_lots l 
    WHERE l.raw_material_id = v_material_id;
  END IF;

  -- Return success with material and lots data
  RETURN jsonb_build_object(
    'success', true,
    'material', to_jsonb(v_existing_material),
    'lots', COALESCE(v_lots_array, '[]'::jsonb)
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition for duplicate codes
    IF SQLSTATE = '23505' AND SQLERRM LIKE '%idx_raw_materials_code_unique_ci%' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_CODE',
        'message', format('RM code "%s" already exists. Use a different code.', p_code)
      );
    ELSE
      -- Re-raise other unique violations
      RAISE;
    END IF;
  WHEN OTHERS THEN
    -- Handle any other errors
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DATABASE_ERROR',
      'message', SQLERRM
    );
END;
$function$;