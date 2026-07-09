-- Auto-populate production ingredient usage with FIFO lot assignment
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
        'error', 'Material not found in inventory'
      ));
      v_success := false;
      CONTINUE;
    END IF;
    
    -- Check total available quantity
    IF (SELECT COALESCE(SUM(quantity), 0) FROM public.raw_material_lots WHERE raw_material_id = v_material_id) < v_required_qty THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_name', v_ingredient_name,
        'required_kg', v_required_qty,
        'available_kg', (SELECT COALESCE(SUM(quantity), 0) FROM public.raw_material_lots WHERE raw_material_id = v_material_id),
        'error', 'Insufficient total inventory'
      ));
      v_success := false;
      CONTINUE;
    END IF;
    
    -- Assign lots using FIFO (First In, First Out)
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
      
      -- Calculate how much to allocate from this lot
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
        'lot_available_qty', v_lot.quantity
      ));
      
      v_remaining_qty := v_remaining_qty - v_allocation_qty;
    END LOOP;
    
    -- Check if we couldn't allocate enough
    IF v_remaining_qty > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_name', v_ingredient_name,
        'required_kg', v_required_qty,
        'allocated_kg', v_required_qty - v_remaining_qty,
        'shortfall_kg', v_remaining_qty,
        'error', 'Insufficient available lots'
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
      ELSE 'Some ingredients could not be auto-populated due to shortages'
    END
  );
END;
$$;