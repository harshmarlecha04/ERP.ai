-- Create function to sync suppliers from raw_materials to suppliers table
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='sync_suppliers_from_inventory' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION sync_suppliers_from_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted_count integer := 0;
  v_existing_count integer := 0;
  v_duplicate_count integer := 0;
  v_supplier_name text;
  v_existing_id uuid;
  supplier_record record;
BEGIN
  -- Check if user has admin permissions
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient permissions'
    );
  END IF;

  -- Loop through unique suppliers from raw_materials
  FOR supplier_record IN 
    SELECT DISTINCT 
      TRIM(supplier) as clean_supplier
    FROM public.raw_materials 
    WHERE supplier IS NOT NULL 
    AND TRIM(supplier) != ''
    ORDER BY TRIM(supplier)
  LOOP
    v_supplier_name := supplier_record.clean_supplier;
    
    -- Check if supplier already exists (case insensitive)
    SELECT id INTO v_existing_id
    FROM public.suppliers 
    WHERE LOWER(TRIM(name)) = LOWER(v_supplier_name);
    
    IF v_existing_id IS NOT NULL THEN
      v_existing_count := v_existing_count + 1;
    ELSE
      -- Insert new supplier
      INSERT INTO public.suppliers (name, contact_info, notes)
      VALUES (
        v_supplier_name,
        NULL,
        'Auto-imported from inventory on ' || now()::date
      );
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'existing_count', v_existing_count,
    'total_processed', v_inserted_count + v_existing_count,
    'message', format('Successfully synced suppliers: %s new, %s existing', 
                     v_inserted_count, v_existing_count)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;