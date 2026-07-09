-- Update deduct_inventory_for_batch function to include ingredient name in error messages
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_batch(p_schedule_item_id uuid, p_formula_code text, p_formula_name text, p_batch_count integer, p_total_produced_qty numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_usage_record RECORD;
  v_completed_batch_id UUID;
  v_current_lot_qty NUMERIC;
  v_ingredient_name TEXT;
  v_result JSONB := '{"success": true, "message": "Inventory deducted successfully"}'::JSONB;
BEGIN
  -- Validate user permissions
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN '{"success": false, "error": "Insufficient permissions"}'::JSONB;
  END IF;
  
  -- Check if already deducted
  IF EXISTS (
    SELECT 1 FROM public.completed_batch_deductions 
    WHERE schedule_item_id = p_schedule_item_id AND status = 'deducted'
  ) THEN
    RETURN '{"success": false, "error": "Inventory already deducted for this batch"}'::JSONB;
  END IF;
  
  -- Create completed batch record
  INSERT INTO public.completed_batch_deductions (
    schedule_item_id, formula_code, formula_name, batch_count, 
    total_produced_qty, completed_by
  ) VALUES (
    p_schedule_item_id, p_formula_code, p_formula_name, p_batch_count,
    p_total_produced_qty, auth.uid()
  ) RETURNING id INTO v_completed_batch_id;
  
  -- Process each ingredient usage and deduct from lots
  FOR v_usage_record IN
    SELECT * FROM public.production_ingredient_usage 
    WHERE schedule_item_id = p_schedule_item_id
  LOOP
    -- Get ingredient name for better error messages
    SELECT name INTO v_ingredient_name
    FROM public.raw_materials
    WHERE id = v_usage_record.raw_material_id;
    
    -- Get current lot quantity if lot_id exists
    IF v_usage_record.lot_id IS NOT NULL THEN
      SELECT quantity INTO v_current_lot_qty
      FROM public.raw_material_lots
      WHERE id = v_usage_record.lot_id;
      
      -- Check if sufficient quantity available
      IF v_current_lot_qty < v_usage_record.actual_quantity_kg THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', format('Insufficient quantity for %s in lot %s. Available: %s kg, Required: %s kg', 
            COALESCE(v_ingredient_name, 'Unknown Material'),
            COALESCE(v_usage_record.lot_number, 'Unknown Lot'), 
            v_current_lot_qty, 
            ROUND(v_usage_record.actual_quantity_kg, 2))
        );
      END IF;
      
      -- Deduct from lot
      UPDATE public.raw_material_lots
      SET quantity = quantity - v_usage_record.actual_quantity_kg,
          updated_at = now()
      WHERE id = v_usage_record.lot_id;
    END IF;
    
    -- Record the deduction for undo capability
    INSERT INTO public.ingredient_deductions (
      completed_batch_id, raw_material_id, ingredient_name,
      supplier_name, lot_id, lot_number, deducted_quantity_kg
    ) VALUES (
      v_completed_batch_id, v_usage_record.raw_material_id, 
      COALESCE(v_ingredient_name, (SELECT name FROM public.raw_materials WHERE id = v_usage_record.raw_material_id)),
      v_usage_record.supplier_name, v_usage_record.lot_id, 
      v_usage_record.lot_number, v_usage_record.actual_quantity_kg
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Inventory deducted successfully',
    'completed_batch_id', v_completed_batch_id
  );
END;
$function$;