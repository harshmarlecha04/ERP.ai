-- Enhanced deduct_inventory_for_batch function with automatic FIFO lot allocation
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
  v_remaining_qty NUMERIC;
  v_ingredient_name TEXT;
  v_warnings jsonb := '[]'::jsonb;
  v_successes jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_total_processed INTEGER := 0;
  v_total_success INTEGER := 0;
  v_over_deductions INTEGER := 0;
  v_lot RECORD;
  v_lot_deduction_qty NUMERIC;
  v_fifo_lots_used jsonb := '[]'::jsonb;
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
  
  -- Process each ingredient usage with FIFO allocation
  FOR v_usage_record IN
    SELECT * FROM public.production_ingredient_usage 
    WHERE schedule_item_id = p_schedule_item_id
  LOOP
    v_total_processed := v_total_processed + 1;
    v_remaining_qty := v_usage_record.actual_quantity_kg;
    v_fifo_lots_used := '[]'::jsonb;
    
    -- Get ingredient name for better reporting
    SELECT name INTO v_ingredient_name
    FROM public.raw_materials
    WHERE id = v_usage_record.raw_material_id;
    
    -- Handle case where lot_id exists (try primary lot first)
    IF v_usage_record.lot_id IS NOT NULL THEN
      -- Get current lot quantity
      SELECT quantity INTO v_current_lot_qty
      FROM public.raw_material_lots
      WHERE id = v_usage_record.lot_id;
      
      -- Deduct from primary lot
      v_lot_deduction_qty := LEAST(v_current_lot_qty, v_remaining_qty);
      
      IF v_lot_deduction_qty > 0 THEN
        -- Update primary lot
        UPDATE public.raw_material_lots
        SET quantity = quantity - v_lot_deduction_qty,
            updated_at = now()
        WHERE id = v_usage_record.lot_id;
        
        -- Record primary lot deduction
        INSERT INTO public.ingredient_deductions (
          completed_batch_id, raw_material_id, ingredient_name,
          supplier_name, lot_id, lot_number, deducted_quantity_kg
        ) VALUES (
          v_completed_batch_id, v_usage_record.raw_material_id, 
          COALESCE(v_ingredient_name, (SELECT name FROM public.raw_materials WHERE id = v_usage_record.raw_material_id)),
          v_usage_record.supplier_name, v_usage_record.lot_id, 
          v_usage_record.lot_number, v_lot_deduction_qty
        );
        
        -- Track lot usage for reporting
        v_fifo_lots_used := v_fifo_lots_used || jsonb_build_array(jsonb_build_object(
          'lot_number', v_usage_record.lot_number,
          'deducted_qty', v_lot_deduction_qty,
          'was_primary', true
        ));
        
        v_remaining_qty := v_remaining_qty - v_lot_deduction_qty;
      END IF;
    END IF;
    
    -- If we still need more quantity, use FIFO allocation from other lots
    IF v_remaining_qty > 0 THEN
      -- Find additional lots for this ingredient using FIFO (oldest first)
      FOR v_lot IN 
        SELECT l.*, rm.supplier
        FROM public.raw_material_lots l
        JOIN public.raw_materials rm ON rm.id = l.raw_material_id
        WHERE l.raw_material_id = v_usage_record.raw_material_id
        AND l.quantity > 0
        AND (v_usage_record.lot_id IS NULL OR l.id != v_usage_record.lot_id) -- Exclude primary lot
        ORDER BY 
          l.receiving_date ASC NULLS LAST, 
          l.created_at ASC, 
          l.id ASC
      LOOP
        EXIT WHEN v_remaining_qty <= 0;
        
        -- Calculate how much to deduct from this lot
        v_lot_deduction_qty := LEAST(v_lot.quantity, v_remaining_qty);
        
        -- Update lot quantity
        UPDATE public.raw_material_lots
        SET quantity = quantity - v_lot_deduction_qty,
            updated_at = now()
        WHERE id = v_lot.id;
        
        -- Record FIFO lot deduction
        INSERT INTO public.ingredient_deductions (
          completed_batch_id, raw_material_id, ingredient_name,
          supplier_name, lot_id, lot_number, deducted_quantity_kg
        ) VALUES (
          v_completed_batch_id, v_usage_record.raw_material_id, 
          COALESCE(v_ingredient_name, (SELECT name FROM public.raw_materials WHERE id = v_usage_record.raw_material_id)),
          v_lot.supplier, v_lot.id, 
          v_lot.lot_number, v_lot_deduction_qty
        );
        
        -- Track FIFO lot usage for reporting
        v_fifo_lots_used := v_fifo_lots_used || jsonb_build_array(jsonb_build_object(
          'lot_number', v_lot.lot_number,
          'deducted_qty', v_lot_deduction_qty,
          'was_primary', false
        ));
        
        v_remaining_qty := v_remaining_qty - v_lot_deduction_qty;
      END LOOP;
    END IF;
    
    -- Report results for this ingredient
    IF v_remaining_qty > 0 THEN
      -- Still have shortage after FIFO allocation
      v_over_deductions := v_over_deductions + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'ingredient_name', COALESCE(v_ingredient_name, 'Unknown Material'),
        'requested_qty', v_usage_record.actual_quantity_kg,
        'deducted_qty', v_usage_record.actual_quantity_kg - v_remaining_qty,
        'shortage_qty', v_remaining_qty,
        'lots_used', v_fifo_lots_used,
        'message', format('Partial deduction: %s kg still needed after using all available lots', 
          ROUND(v_remaining_qty, 2))
      ));
    ELSE
      -- Successfully deducted full amount using FIFO
      v_successes := v_successes || jsonb_build_array(jsonb_build_object(
        'ingredient_name', COALESCE(v_ingredient_name, 'Unknown Material'),
        'deducted_qty', v_usage_record.actual_quantity_kg,
        'lots_used', v_fifo_lots_used,
        'message', CASE 
          WHEN jsonb_array_length(v_fifo_lots_used) > 1 THEN 
            format('Successfully deducted using FIFO allocation across %s lots', jsonb_array_length(v_fifo_lots_used))
          ELSE 'Successfully deducted from single lot'
        END
      ));
    END IF;
    
    v_total_success := v_total_success + 1;
  END LOOP;
  
  -- Return comprehensive result
  RETURN jsonb_build_object(
    'success', true,
    'completed_batch_id', v_completed_batch_id,
    'total_processed', v_total_processed,
    'total_success', v_total_success,
    'over_deductions', v_over_deductions,
    'warnings', v_warnings,
    'successes', v_successes,
    'errors', v_errors,
    'message', CASE 
      WHEN v_over_deductions > 0 THEN 
        format('Deduction completed with FIFO allocation. %s ingredients had shortages after using all available lots.', v_over_deductions)
      ELSE 'All inventory deducted successfully using FIFO allocation.'
    END
  );
END;
$$;