-- Fix the database function to use the correct column name 'expires_on' instead of 'expiry_date'
CREATE OR REPLACE FUNCTION public.create_raw_material_with_lots_v2(p_code text, p_name text, p_supplier text DEFAULT NULL::text, p_unit_of_measure text DEFAULT 'kg'::text, p_lots jsonb DEFAULT '[]'::jsonb, p_idempotency_key uuid DEFAULT NULL::uuid)
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
  INSERT INTO public.raw_materials (code, name, supplier, uom, idempotency_key)
  VALUES (p_code, p_name, p_supplier, p_unit_of_measure, p_idempotency_key)
  RETURNING * INTO v_existing_material;

  v_material_id := v_existing_material.id;

  -- Bulk insert lots if provided (much faster than individual inserts)
  IF jsonb_array_length(p_lots) > 0 THEN
    -- Single bulk insert operation - FIXED: use 'expires_on' instead of 'expiry_date'
    INSERT INTO public.raw_material_lots (
      raw_material_id, lot_number, quantity, cost, expires_on, coa_link
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
$function$