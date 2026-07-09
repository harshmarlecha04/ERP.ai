-- Enhanced auto-populate function with better inventory visibility
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='auto_populate_production_ingredients' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.auto_populate_production_ingredients(
  p_schedule_item_id uuid,
  p_formula_id uuid,
  p_batches integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Validate user permissions
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  -- Get formula recipe
  SELECT recipe_json INTO v_formula_recipe
  FROM public.formulas 
  WHERE id = p_formula_id AND NOT is_deleted;
  
  IF v_formula_recipe IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Formula not found or has no recipe');
  END IF;
  
  -- Clear existing production ingredient usage for this schedule item
  DELETE FROM public.production_ingredient_usage 
  WHERE schedule_item_id = p_schedule_item_id;
  
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
        'error', 'Insufficient total inventory - will over-deduct'
      ));
      -- Continue processing but mark as not fully successful
      v_success := false;
    END IF;
    
    -- Assign lots using FIFO (First In, First Out) - even for over-deduction
    v_remaining_qty := v_required_qty;
    
    FOR v_lot IN 
      SELECT l.*, rm.supplier
      FROM public.raw_material_lots l
      JOIN public.raw_materials rm ON rm.id = l.raw_material_id
      WHERE l.raw_material_id = v_material_id 
      AND l.quantity > 0
      ORDER BY l.receiving_date ASC NULLS LAST, l.created_at ASC, l.id ASC
    LOOP
      EXIT WHEN v_remaining_qty <= 0;
      
      -- Calculate how much to allocate from this lot (can exceed lot quantity for over-deduction)
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
        created_by
      ) VALUES (
        p_schedule_item_id,
        v_material_id,
        v_lot.id,
        v_lot.supplier,
        v_lot.lot_number,
        v_allocation_qty,
        v_allocation_qty,
        CASE 
          WHEN v_required_qty > 0 THEN 
            ROUND((v_allocation_qty / v_required_qty * p_batches)::numeric, 0)::integer
          ELSE 0
        END,
        auth.uid()
      );
      
      -- Track assignment for response
      v_assignments := v_assignments || jsonb_build_array(jsonb_build_object(
        'ingredient_name', v_ingredient_name,
        'raw_material_id', v_material_id,
        'lot_id', v_lot.id,
        'supplier_name', v_lot.supplier,
        'lot_number', v_lot.lot_number,
        'allocated_qty', v_allocation_qty,
        'current_lot_qty', v_lot.quantity,
        'after_deduction_qty', GREATEST(v_lot.quantity - v_allocation_qty, 0),
        'current_total_inventory_kg', v_total_available_qty,
        'after_total_inventory_kg', GREATEST(v_total_available_qty - v_required_qty, 0)
      ));
      
      v_remaining_qty := v_remaining_qty - v_allocation_qty;
    END LOOP;
    
    -- If we still couldn't allocate enough (no lots available), create a shortage entry
    IF v_remaining_qty > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_name', v_ingredient_name,
        'required_kg', v_required_qty,
        'allocated_kg', v_required_qty - v_remaining_qty,
        'shortfall_kg', v_remaining_qty,
        'current_total_inventory_kg', v_total_available_qty,
        'after_deduction_kg', 0,
        'error', 'No available lots found'
      ));
      v_success := false;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', v_success,
    'assignments', v_assignments,
    'shortages', v_shortages,
    'total_ingredients_processed', jsonb_array_length(v_formula_recipe),
    'message', CASE 
      WHEN v_success THEN 'All ingredients auto-populated successfully'
      ELSE 'Some ingredients have issues - review before proceeding'
    END
  );
END;
$$;

-- Enhanced deduct inventory function with over-deduction support
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='deduct_inventory_for_batch' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_batch(
  p_schedule_item_id uuid,
  p_formula_code text,
  p_formula_name text,
  p_batch_count integer,
  p_total_produced_qty numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usage_record RECORD;
  v_completed_batch_id UUID;
  v_current_lot_qty NUMERIC;
  v_deduction_qty NUMERIC;
  v_ingredient_name TEXT;
  v_warnings jsonb := '[]'::jsonb;
  v_successes jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_total_processed INTEGER := 0;
  v_total_success INTEGER := 0;
  v_over_deductions INTEGER := 0;
BEGIN
  -- Validate user permissions
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  -- Check if already deducted
  IF EXISTS (
    SELECT 1 FROM public.completed_batch_deductions 
    WHERE schedule_item_id = p_schedule_item_id AND status = 'deducted'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory already deducted for this batch');
  END IF;
  
  -- Create completed batch record
  INSERT INTO public.completed_batch_deductions (
    schedule_item_id, formula_code, formula_name, batch_count, 
    total_produced_qty, completed_by
  ) VALUES (
    p_schedule_item_id, p_formula_code, p_formula_name, p_batch_count,
    p_total_produced_qty, auth.uid()
  ) RETURNING id INTO v_completed_batch_id;
  
  -- Process each ingredient usage - continue even if issues found
  FOR v_usage_record IN
    SELECT * FROM public.production_ingredient_usage 
    WHERE schedule_item_id = p_schedule_item_id
  LOOP
    v_total_processed := v_total_processed + 1;
    
    -- Get ingredient name for better reporting
    SELECT name INTO v_ingredient_name
    FROM public.raw_materials
    WHERE id = v_usage_record.raw_material_id;
    
    -- Handle case where lot_id exists
    IF v_usage_record.lot_id IS NOT NULL THEN
      -- Get current lot quantity
      SELECT quantity INTO v_current_lot_qty
      FROM public.raw_material_lots
      WHERE id = v_usage_record.lot_id;
      
      -- Determine actual deduction quantity (allow over-deduction)
      v_deduction_qty := v_usage_record.actual_quantity_kg;
      
      -- Check for over-deduction
      IF v_current_lot_qty < v_deduction_qty THEN
        v_over_deductions := v_over_deductions + 1;
        
        -- Log warning for over-deduction
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'ingredient_name', COALESCE(v_ingredient_name, 'Unknown Material'),
          'lot_number', COALESCE(v_usage_record.lot_number, 'Unknown Lot'),
          'current_qty', v_current_lot_qty,
          'requested_qty', v_deduction_qty,
          'actual_deducted', v_current_lot_qty,
          'message', format('Over-deduction: Set inventory to 0. Requested %s kg but only %s kg available', 
            ROUND(v_deduction_qty, 2), ROUND(v_current_lot_qty, 2))
        ));
        
        -- Deduct all available (set to 0)
        UPDATE public.raw_material_lots
        SET quantity = 0,
            updated_at = now()
        WHERE id = v_usage_record.lot_id;
        
        -- Record what was actually deducted
        INSERT INTO public.ingredient_deductions (
          completed_batch_id, raw_material_id, ingredient_name,
          supplier_name, lot_id, lot_number, deducted_quantity_kg
        ) VALUES (
          v_completed_batch_id, v_usage_record.raw_material_id, 
          COALESCE(v_ingredient_name, (SELECT name FROM public.raw_materials WHERE id = v_usage_record.raw_material_id)),
          v_usage_record.supplier_name, v_usage_record.lot_id, 
          v_usage_record.lot_number, v_current_lot_qty -- Actual deducted amount
        );
        
      ELSE
        -- Normal deduction
        UPDATE public.raw_material_lots
        SET quantity = quantity - v_deduction_qty,
            updated_at = now()
        WHERE id = v_usage_record.lot_id;
        
        -- Record normal deduction
        INSERT INTO public.ingredient_deductions (
          completed_batch_id, raw_material_id, ingredient_name,
          supplier_name, lot_id, lot_number, deducted_quantity_kg
        ) VALUES (
          v_completed_batch_id, v_usage_record.raw_material_id, 
          COALESCE(v_ingredient_name, (SELECT name FROM public.raw_materials WHERE id = v_usage_record.raw_material_id)),
          v_usage_record.supplier_name, v_usage_record.lot_id, 
          v_usage_record.lot_number, v_deduction_qty
        );
        
        -- Log successful deduction
        v_successes := v_successes || jsonb_build_array(jsonb_build_object(
          'ingredient_name', COALESCE(v_ingredient_name, 'Unknown Material'),
          'lot_number', COALESCE(v_usage_record.lot_number, 'Unknown Lot'),
          'deducted_qty', v_deduction_qty,
          'remaining_qty', v_current_lot_qty - v_deduction_qty
        ));
      END IF;
      
      v_total_success := v_total_success + 1;
      
    ELSE
      -- Handle case where no lot_id (shouldn't happen in normal flow)
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'ingredient_name', COALESCE(v_ingredient_name, 'Unknown Material'),
        'error', 'No lot ID specified - cannot deduct inventory'
      ));
    END IF;
  END LOOP;
  
  -- Return comprehensive result
  RETURN jsonb_build_object(
    'success', true, -- Always return success unless permissions fail
    'completed_batch_id', v_completed_batch_id,
    'total_processed', v_total_processed,
    'total_success', v_total_success,
    'over_deductions', v_over_deductions,
    'warnings', v_warnings,
    'successes', v_successes,
    'errors', v_errors,
    'message', CASE 
      WHEN v_over_deductions > 0 THEN 
        format('Deduction completed with %s over-deductions (set to 0)', v_over_deductions)
      ELSE 'All inventory deducted successfully'
    END
  );
END;
$$;