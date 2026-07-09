-- Fix security warning: Set search_path for functions that need it
-- Only set for user-defined functions that currently don't have it set

-- Fix function_search_path_mutable warnings by setting search_path where appropriate
-- Note: Only updating functions that we control and should have search_path set

-- Update the create_raw_material_with_lots function 
DROP FUNCTION IF EXISTS public.create_raw_material_with_lots(text, text, text, text, jsonb);

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='create_raw_material_with_lots' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.create_raw_material_with_lots(
  p_code text, 
  p_name text, 
  p_supplier text DEFAULT NULL::text, 
  p_unit_of_measure text DEFAULT 'kg'::text, 
  p_lots jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_material_id uuid;
  v_material record;
  v_lots jsonb := '[]'::jsonb;
  v_lot record;
  v_lot_data jsonb;
BEGIN
  -- Check if code already exists (case insensitive)
  IF EXISTS (SELECT 1 FROM public.raw_materials WHERE UPPER(code) = UPPER(p_code)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_CODE',
      'message', format('RM code "%s" already exists. Please use a different code.', p_code)
    );
  END IF;

  -- Insert raw material
  INSERT INTO public.raw_materials (code, name, supplier, unit_of_measure)
  VALUES (p_code, p_name, p_supplier, p_unit_of_measure)
  RETURNING * INTO v_material;

  v_material_id := v_material.id;

  -- Insert lots if provided
  IF jsonb_array_length(p_lots) > 0 THEN
    FOR v_lot_data IN SELECT * FROM jsonb_array_elements(p_lots)
    LOOP
      INSERT INTO public.raw_material_lots (
        raw_material_id,
        lot_number,
        quantity,
        cost,
        expiry_date,
        coa_link
      )
      VALUES (
        v_material_id,
        NULLIF(trim(v_lot_data->>'lot_number'), ''),
        COALESCE((v_lot_data->>'quantity')::numeric, 0),
        COALESCE((v_lot_data->>'cost')::numeric, 0),
        NULLIF(v_lot_data->>'expiry_date', '')::date,
        NULLIF(trim(v_lot_data->>'coa_link'), '')
      )
      RETURNING to_jsonb(raw_material_lots.*) INTO v_lot;
      
      v_lots := v_lots || v_lot;
    END LOOP;
  END IF;

  -- Return success with material and lots data
  RETURN jsonb_build_object(
    'success', true,
    'material', to_jsonb(v_material),
    'lots', v_lots
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition where code was inserted between check and insert
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_CODE',
      'message', format('RM code "%s" already exists. Please use a different code.', p_code)
    );
  WHEN OTHERS THEN
    -- Handle any other errors
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DATABASE_ERROR',
      'message', SQLERRM
    );
END;
$function$;