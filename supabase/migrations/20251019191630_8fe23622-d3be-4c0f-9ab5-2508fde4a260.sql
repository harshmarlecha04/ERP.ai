-- Create function to schedule production for an order
CREATE OR REPLACE FUNCTION schedule_production_for_order(
  p_order_id uuid,
  p_start_date date,
  p_daily_batch_allocation jsonb  -- Array of {date: 'YYYY-MM-DD', batches: N}
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_formula_id uuid;
  v_formula_code text;
  v_day_record jsonb;
  v_schedule_id uuid;
  v_schedule_item_id uuid;
  v_batch_alloc_date date;
  v_batch_count integer;
  v_materials_check jsonb;
  v_created_items jsonb := '[]'::jsonb;
  v_total_scheduled_batches integer := 0;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM public.customer_orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Get formula details
  SELECT id, code INTO v_formula_id, v_formula_code
  FROM public.formulas
  WHERE id = v_order.formula_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Formula not found'
    );
  END IF;
  
  -- Process each day's batch allocation
  FOR v_day_record IN SELECT * FROM jsonb_array_elements(p_daily_batch_allocation)
  LOOP
    v_batch_alloc_date := (v_day_record->>'date')::date;
    v_batch_count := (v_day_record->>'batches')::integer;
    
    IF v_batch_count <= 0 THEN
      CONTINUE;
    END IF;
    
    -- Check materials for this date and batch count
    v_materials_check := public.fn_check_materials(
      v_formula_id,
      v_batch_count,
      v_batch_alloc_date,
      NULL::uuid
    );
    
    IF NOT COALESCE((v_materials_check->>'materials_ok')::boolean, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient materials for date ' || v_batch_alloc_date,
        'date', v_batch_alloc_date,
        'shortages', v_materials_check->'shortages'
      );
    END IF;
    
    -- Get or create schedule for this date
    v_schedule_id := public.fn_upsert_schedule(v_batch_alloc_date);
    
    -- Create production schedule item
    INSERT INTO public.production_schedule_items (
      schedule_id,
      formula_id,
      formula_code,
      batches,
      total_required_kg,
      materials_ok,
      shortages_json
    ) VALUES (
      v_schedule_id,
      v_formula_id,
      v_formula_code,
      v_batch_count,
      0, -- Will be calculated by triggers if needed
      true,
      '[]'::jsonb
    )
    RETURNING id INTO v_schedule_item_id;
    
    -- Link to order via order_production_batches
    INSERT INTO public.order_production_batches (
      customer_order_id,
      production_schedule_item_id,
      estimated_bottles,
      batch_sequence
    ) VALUES (
      p_order_id,
      v_schedule_item_id,
      (v_batch_count * 43000) / v_order.bottle_size, -- Estimate based on 43k gummies per batch
      v_total_scheduled_batches + 1
    );
    
    -- Try to reserve materials
    BEGIN
      PERFORM public.fn_reserve_materials(v_schedule_item_id);
    EXCEPTION WHEN OTHERS THEN
      -- If reservation fails, rollback will happen
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to reserve materials: ' || SQLERRM,
        'date', v_batch_alloc_date
      );
    END;
    
    -- Add to created items list
    v_created_items := v_created_items || jsonb_build_array(
      jsonb_build_object(
        'date', v_batch_alloc_date,
        'schedule_id', v_schedule_id,
        'schedule_item_id', v_schedule_item_id,
        'batches', v_batch_count
      )
    );
    
    v_total_scheduled_batches := v_total_scheduled_batches + v_batch_count;
  END LOOP;
  
  -- Update order status to scheduled
  UPDATE public.customer_orders
  SET status = 'scheduled',
      updated_at = now()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'total_batches_scheduled', v_total_scheduled_batches,
    'scheduled_items', v_created_items
  );
END;
$$;