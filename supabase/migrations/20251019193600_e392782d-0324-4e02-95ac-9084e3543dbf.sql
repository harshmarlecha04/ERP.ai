-- Phase 1-3: Material Reservation Decoupling (Simplified - No Enum)

-- 1. Create material_reservations_history table for audit trail
CREATE TABLE IF NOT EXISTS public.material_reservations_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  schedule_item_id uuid REFERENCES public.production_schedule_items(id) ON DELETE CASCADE,
  reserved_by uuid REFERENCES auth.users(id),
  reserved_at timestamptz DEFAULT now(),
  reservation_details jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
DO $rls$ BEGIN ALTER TABLE public.material_reservations_history ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS Policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view reservation history" ON public.material_reservations_history; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view reservation history"
  ON public.material_reservations_history FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can insert reservation history" ON public.material_reservations_history; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can insert reservation history"
  ON public.material_reservations_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. Update schedule_production_for_order to make material reservation optional
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='schedule_production_for_order' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.schedule_production_for_order(
  p_order_id uuid,
  p_start_date date,
  p_daily_batch_allocation jsonb,
  p_reserve_materials boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_formula_id uuid;
  v_total_batches integer := 0;
  v_schedule_item_ids uuid[] := '{}';
  v_day_data jsonb;
  v_current_date date;
  v_batches_for_day integer;
  v_schedule_id uuid;
  v_schedule_item_id uuid;
  v_batch_sequence integer := 0;
  v_estimated_bottles integer;
  v_gummies_per_batch integer;
  v_material_check jsonb;
  v_reservation_result jsonb;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM public.customer_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  v_formula_id := v_order.formula_id;
  
  -- Get gummies per batch from formula
  SELECT gummies_per_batch INTO v_gummies_per_batch
  FROM public.formulas WHERE id = v_formula_id;
  
  IF v_gummies_per_batch IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Formula does not have gummies_per_batch configured');
  END IF;
  
  -- Calculate total batches from allocation
  FOR v_day_data IN SELECT * FROM jsonb_array_elements(p_daily_batch_allocation)
  LOOP
    v_total_batches := v_total_batches + (v_day_data->>'batches')::integer;
  END LOOP;
  
  -- Validate materials are available (but don't reserve yet)
  v_material_check := public.fn_check_materials(
    v_formula_id,
    v_total_batches,
    p_start_date,
    NULL
  );
  
  IF NOT COALESCE((v_material_check->>'materials_ok')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient materials',
      'shortages', v_material_check->'shortages'
    );
  END IF;
  
  -- Create schedule items for each production day
  FOR v_day_data IN SELECT * FROM jsonb_array_elements(p_daily_batch_allocation)
  LOOP
    v_current_date := (v_day_data->>'date')::date;
    v_batches_for_day := (v_day_data->>'batches')::integer;
    
    CONTINUE WHEN v_batches_for_day <= 0;
    
    -- Get or create production schedule for this date
    v_schedule_id := public.fn_upsert_schedule(v_current_date);
    
    -- Calculate estimated bottles for this day
    v_estimated_bottles := CEIL((v_batches_for_day * v_gummies_per_batch)::numeric / v_order.bottle_size);
    
    -- Create schedule item
    INSERT INTO public.production_schedule_items (
      schedule_id,
      formula_id,
      batches,
      total_required_kg,
      materials_ok,
      shortages_json,
      formula_code
    ) VALUES (
      v_schedule_id,
      v_formula_id,
      v_batches_for_day,
      0,
      true,
      '[]'::jsonb,
      (SELECT code FROM public.formulas WHERE id = v_formula_id)
    )
    RETURNING id INTO v_schedule_item_id;
    
    v_schedule_item_ids := array_append(v_schedule_item_ids, v_schedule_item_id);
    
    -- Link to order via order_production_batches
    INSERT INTO public.order_production_batches (
      customer_order_id,
      production_schedule_item_id,
      estimated_bottles,
      batch_sequence
    ) VALUES (
      p_order_id,
      v_schedule_item_id,
      v_estimated_bottles,
      v_batch_sequence + 1
    );
    
    v_batch_sequence := v_batch_sequence + 1;
  END LOOP;
  
  -- Optionally reserve materials if requested
  IF p_reserve_materials THEN
    FOR v_schedule_item_id IN SELECT unnest(v_schedule_item_ids)
    LOOP
      v_reservation_result := public.fn_reserve_materials(v_schedule_item_id);
      
      IF NOT COALESCE((v_reservation_result->>'ok')::boolean, false) THEN
        RAISE WARNING 'Failed to reserve materials for schedule item %', v_schedule_item_id;
      END IF;
    END LOOP;
  END IF;
  
  -- Update order status based on reservation
  UPDATE public.customer_orders
  SET 
    status = CASE 
      WHEN p_reserve_materials THEN 'materials_reserved'
      ELSE 'scheduled'
    END,
    updated_at = now()
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'schedule_item_ids', to_jsonb(v_schedule_item_ids),
    'total_batches_scheduled', v_total_batches,
    'materials_reserved', p_reserve_materials
  );
END;
$$;

-- 3. Update auto status trigger to include materials_reserved
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='auto_update_order_status' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.auto_update_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_all_completed boolean;
  v_any_in_production boolean;
  v_any_packaging boolean;
  v_current_status text;
  v_new_status text;
  v_old_status text;
BEGIN
  -- Get the order_id from order_production_batches
  SELECT customer_order_id INTO v_order_id
  FROM public.order_production_batches
  WHERE production_schedule_item_id = NEW.id
  LIMIT 1;
  
  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get current order status
  SELECT status INTO v_current_status
  FROM public.customer_orders
  WHERE id = v_order_id;
  
  v_old_status := v_current_status;
  
  -- Check production batch statuses
  SELECT 
    bool_and(psi.current_stage = 'completed') as all_completed,
    bool_or(psi.current_stage IN ('production', 'drying', 'coating')) as any_in_production,
    bool_or(psi.current_stage = 'packaging') as any_packaging
  INTO v_all_completed, v_any_in_production, v_any_packaging
  FROM public.order_production_batches opb
  JOIN public.production_schedule_items psi ON psi.id = opb.production_schedule_item_id
  WHERE opb.customer_order_id = v_order_id;
  
  -- Determine new status
  IF v_all_completed THEN
    v_new_status := 'ready_to_ship';
  ELSIF v_any_packaging THEN
    v_new_status := 'packaging';
  ELSIF v_any_in_production THEN
    v_new_status := 'in_production';
  ELSIF v_current_status IN ('scheduled', 'materials_reserved') THEN
    v_new_status := v_current_status; -- Keep scheduled/reserved if nothing started yet
  END IF;
  
  -- Update order status if changed
  IF v_new_status IS NOT NULL AND v_new_status != v_current_status THEN
    UPDATE public.customer_orders
    SET status = v_new_status,
        updated_at = now()
    WHERE id = v_order_id;
    
    -- Log status change
    INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, notes)
    VALUES (
      v_order_id,
      v_old_status,
      v_new_status,
      auth.uid(),
      'Auto-updated based on production progress'
    );
  END IF;
  
  RETURN NEW;
END;
$$;