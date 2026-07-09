-- Fix the policy conflict and create the enhanced function
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage usage sessions" ON public.production_ingredient_usage_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Enhanced auto-populate function with transaction safety, idempotency, and overwrite protection
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='auto_populate_production_ingredients_safe' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.auto_populate_production_ingredients_safe(
  p_schedule_item_id uuid, 
  p_formula_id uuid, 
  p_batches integer,
  p_idempotency_key uuid DEFAULT gen_random_uuid(),
  p_force_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_formula_recipe jsonb;
  v_ingredient jsonb;
  v_ingredient_name text;
  v_material_id uuid;
  v_required_qty numeric;
  v_remaining_qty numeric;
  v_total_available_qty numeric;
  v_lot record;
  v_allocation_qty numeric;
  v_assignments jsonb := '[]'::jsonb;
  v_shortages jsonb := '[]'::jsonb;
  v_success boolean := true;
  v_existing_count integer := 0;
  v_existing_assignments jsonb := '[]'::jsonb;
  v_session_checksum text;
BEGIN
  -- Validate user permissions
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  -- Check for idempotency - if we've processed this exact request before, return cached result
  IF EXISTS (
    SELECT 1 FROM public.production_ingredient_usage_sessions 
    WHERE schedule_item_id = p_schedule_item_id 
    AND idempotency_key = p_idempotency_key
    AND created_at > now() - interval '1 hour'
  ) THEN
    -- Return previous result
    SELECT result INTO v_assignments FROM public.production_ingredient_usage_sessions 
    WHERE schedule_item_id = p_schedule_item_id AND idempotency_key = p_idempotency_key
    ORDER BY created_at DESC LIMIT 1;
    
    RETURN jsonb_build_object(
      'success', true, 
      'assignments', COALESCE(v_assignments, '[]'::jsonb),
      'shortages', '[]'::jsonb,
      'total_ingredients_processed', jsonb_array_length(COALESCE(v_assignments, '[]'::jsonb)),
      'message', 'Retrieved cached result (idempotent request)',
      'was_cached', true
    );
  END IF;
  
  -- Get formula recipe
  SELECT recipe_json INTO v_formula_recipe
  FROM public.formulas 
  WHERE id = p_formula_id AND NOT is_deleted;
  
  IF v_formula_recipe IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Formula not found or has no recipe');
  END IF;
  
  -- Check for existing assignments and build overwrite warning
  SELECT COUNT(*), jsonb_agg(
    jsonb_build_object(
      'ingredient_name', rm.name,
      'supplier_name', piu.supplier_name,
      'lot_number', piu.lot_number,
      'allocated_qty', piu.actual_quantity_kg
    )
  ) INTO v_existing_count, v_existing_assignments
  FROM public.production_ingredient_usage piu
  JOIN public.raw_materials rm ON rm.id = piu.raw_material_id
  WHERE piu.schedule_item_id = p_schedule_item_id;
  
  -- If existing assignments found and force_overwrite is false, return warning
  IF v_existing_count > 0 AND NOT p_force_overwrite THEN
    RETURN jsonb_build_object(
      'success', false,
      'requires_overwrite_confirmation', true,
      'existing_assignments', COALESCE(v_existing_assignments, '[]'::jsonb),
      'existing_count', v_existing_count,
      'message', format('Found %s existing ingredient assignments. Set force_overwrite=true to replace them.', v_existing_count)
    );
  END IF;
  
  -- Start transaction with row-level locks
  BEGIN
    -- Lock the schedule item to prevent concurrent modifications
    PERFORM * FROM public.production_schedule_items 
    WHERE id = p_schedule_item_id FOR UPDATE;
    
    -- Lock all relevant raw material lots for allocation
    PERFORM * FROM public.raw_material_lots l
    JOIN public.raw_materials rm ON rm.id = l.raw_material_id
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_formula_recipe) AS ingredient
      WHERE LOWER(rm.name) = LOWER(ingredient->>'materialName')
    ) FOR UPDATE;
    
    -- Clear existing assignments if we're overwriting
    IF v_existing_count > 0 THEN
      DELETE FROM public.production_ingredient_usage 
      WHERE schedule_item_id = p_schedule_item_id;
    END IF;
    
    -- Generate session checksum for integrity
    v_session_checksum := encode(extensions.digest(
      p_schedule_item_id::text || p_formula_id::text || p_batches::text || now()::text, 
      'sha256'
    ), 'hex');
    
    -- Process each ingredient in the recipe
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(v_formula_recipe)
    LOOP
      -- Extract ingredient information
      v_ingredient_name := v_ingredient->>'materialName';
      v_required_qty := (v_ingredient->>'weightKg')::numeric * p_batches;
      
      CONTINUE WHEN v_ingredient_name IS NULL OR v_required_qty <= 0;
      
      -- Find raw material by name (case-insensitive)
      SELECT id INTO v_material_id
      FROM public.raw_materials
      WHERE LOWER(name) = LOWER(v_ingredient_name)
      LIMIT 1;
      
      IF v_material_id IS NULL THEN
        -- Log missing material
        v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
          'ingredient_name', v_ingredient_name,
          'required_kg', v_required_qty,
          'current_total_inventory_kg', 0,
          'after_deduction_kg', 0,
          'error', 'Material not found in inventory'
        ));
        v_success := false;
        CONTINUE;
      END IF;
      
      -- Get total available inventory for this material
      SELECT COALESCE(SUM(quantity), 0) INTO v_total_available_qty
      FROM public.raw_material_lots 
      WHERE raw_material_id = v_material_id;
      
      -- Check if sufficient quantity available
      IF v_total_available_qty < v_required_qty THEN
        v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
          'ingredient_name', v_ingredient_name,
          'required_kg', v_required_qty,
          'current_total_inventory_kg', v_total_available_qty,
          'after_deduction_kg', GREATEST(v_total_available_qty - v_required_qty, 0),
          'shortfall_kg', v_required_qty - v_total_available_qty,
          'error', 'Insufficient total inventory'
        ));
        v_success := false;
        CONTINUE;
      END IF;
      
      -- Assign lots using FIFO
      v_remaining_qty := v_required_qty;
      
      FOR v_lot IN 
        SELECT l.*, rm.supplier
        FROM public.raw_material_lots l
        JOIN public.raw_materials rm ON rm.id = l.raw_material_id
        WHERE l.raw_material_id = v_material_id 
        AND l.quantity > 0
        ORDER BY 
          l.receiving_date ASC NULLS LAST, 
          l.created_at ASC, 
          l.id ASC
      LOOP
        EXIT WHEN v_remaining_qty <= 0;
        
        -- Calculate allocation (never exceed lot quantity)
        v_allocation_qty := LEAST(v_remaining_qty, v_lot.quantity);
        
        -- Insert production ingredient usage record
        INSERT INTO public.production_ingredient_usage (
          schedule_item_id,
          raw_material_id,
          lot_id,
          supplier_name,
          lot_number,
          required_quantity_kg,
          actual_quantity_kg,
          batches_used,
          created_by,
          session_checksum
        ) VALUES (
          p_schedule_item_id,
          v_material_id,
          v_lot.id,
          v_lot.supplier,
          v_lot.lot_number,
          v_allocation_qty,
          v_allocation_qty,
          p_batches,
          auth.uid(),
          v_session_checksum
        );
        
        -- Build assignment record
        v_assignments := v_assignments || jsonb_build_array(jsonb_build_object(
          'ingredient_name', v_ingredient_name,
          'raw_material_id', v_material_id,
          'lot_id', v_lot.id,
          'supplier_name', v_lot.supplier,
          'lot_number', v_lot.lot_number,
          'allocated_qty', v_allocation_qty,
          'current_lot_qty', v_lot.quantity,
          'after_deduction_qty', v_lot.quantity - v_allocation_qty,
          'current_total_inventory_kg', v_total_available_qty,
          'after_total_inventory_kg', v_total_available_qty - v_allocation_qty
        ));
        
        v_remaining_qty := v_remaining_qty - v_allocation_qty;
      END LOOP;
      
      -- If we couldn't allocate everything, log shortage
      IF v_remaining_qty > 0 THEN
        v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
          'ingredient_name', v_ingredient_name,
          'required_kg', v_required_qty,
          'allocated_kg', v_required_qty - v_remaining_qty,
          'shortfall_kg', v_remaining_qty,
          'error', 'Partial allocation - insufficient lot quantities'
        ));
        v_success := false;
      END IF;
    END LOOP;
    
    -- Store session for idempotency
    INSERT INTO public.production_ingredient_usage_sessions (
      schedule_item_id,
      idempotency_key,
      session_checksum,
      result,
      created_by
    ) VALUES (
      p_schedule_item_id,
      p_idempotency_key,
      v_session_checksum,
      v_assignments,
      auth.uid()
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback handled automatically
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Transaction failed: ' || SQLERRM,
        'assignments', '[]'::jsonb,
        'shortages', '[]'::jsonb,
        'total_ingredients_processed', 0,
        'message', 'Auto-population failed due to database error'
      );
  END;
  
  -- Return comprehensive result
  RETURN jsonb_build_object(
    'success', v_success,
    'assignments', v_assignments,
    'shortages', v_shortages,
    'total_ingredients_processed', jsonb_array_length(v_assignments),
    'message', CASE 
      WHEN v_success THEN 'All ingredients successfully auto-populated with FIFO allocation'
      ELSE 'Auto-population completed with some shortages or issues'
    END,
    'session_checksum', v_session_checksum,
    'idempotency_key', p_idempotency_key,
    'existing_assignments_replaced', v_existing_count
  );
END;
$function$;

-- Create sessions table for idempotency and audit
CREATE TABLE IF NOT EXISTS public.production_ingredient_usage_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_item_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  session_checksum text NOT NULL,
  result jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add session_checksum column to production_ingredient_usage for integrity
ALTER TABLE public.production_ingredient_usage 
ADD COLUMN IF NOT EXISTS session_checksum text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_sessions_schedule_item ON public.production_ingredient_usage_sessions(schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_idempotency ON public.production_ingredient_usage_sessions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_usage_checksum ON public.production_ingredient_usage(session_checksum);

-- Enable RLS on new table
DO $rls$ BEGIN ALTER TABLE public.production_ingredient_usage_sessions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create RLS policy for sessions table
DO $pol$ BEGIN DROP POLICY IF EXISTS "users_can_manage_usage_sessions" ON public.production_ingredient_usage_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "users_can_manage_usage_sessions" 
ON public.production_ingredient_usage_sessions
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;