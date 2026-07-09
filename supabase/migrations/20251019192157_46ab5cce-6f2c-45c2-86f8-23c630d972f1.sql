-- Create order status history table for audit trail
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order status history"
  ON public.order_status_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert order status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to automatically update order status based on batch progress
CREATE OR REPLACE FUNCTION public.auto_update_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_current_status text;
  v_new_status text;
  v_total_batches integer;
  v_in_production_count integer;
  v_in_packaging_count integer;
  v_completed_count integer;
BEGIN
  -- Get all orders linked to this production schedule item
  FOR v_order_id IN 
    SELECT DISTINCT opb.customer_order_id
    FROM public.order_production_batches opb
    WHERE opb.production_schedule_item_id = NEW.id
  LOOP
    -- Get current order status
    SELECT status INTO v_current_status
    FROM public.customer_orders
    WHERE id = v_order_id;
    
    -- Count total batches for this order
    SELECT COUNT(*) INTO v_total_batches
    FROM public.order_production_batches opb
    JOIN public.production_schedule_items psi ON psi.id = opb.production_schedule_item_id
    WHERE opb.customer_order_id = v_order_id;
    
    -- Count batches in different stages
    SELECT 
      COUNT(*) FILTER (WHERE psi.current_stage IN ('in_production', 'drying', 'conditioning')) as in_prod,
      COUNT(*) FILTER (WHERE psi.current_stage = 'packaging') as in_pack,
      COUNT(*) FILTER (WHERE psi.current_stage = 'completed' AND opb.actual_bottles_packed IS NOT NULL) as completed
    INTO v_in_production_count, v_in_packaging_count, v_completed_count
    FROM public.order_production_batches opb
    JOIN public.production_schedule_items psi ON psi.id = opb.production_schedule_item_id
    WHERE opb.customer_order_id = v_order_id;
    
    -- Determine new status
    v_new_status := v_current_status;
    
    IF v_completed_count = v_total_batches AND v_total_batches > 0 THEN
      v_new_status := 'ready_to_ship';
    ELSIF v_in_packaging_count > 0 OR (v_completed_count > 0 AND v_completed_count < v_total_batches) THEN
      v_new_status := 'packaging';
    ELSIF v_in_production_count > 0 THEN
      v_new_status := 'in_production';
    ELSIF v_current_status = 'scheduled' THEN
      v_new_status := 'scheduled';
    END IF;
    
    -- Update order status if changed
    IF v_new_status != v_current_status THEN
      UPDATE public.customer_orders
      SET status = v_new_status, updated_at = now()
      WHERE id = v_order_id;
      
      -- Log the status change
      INSERT INTO public.order_status_history (order_id, old_status, new_status, changed_by, notes)
      VALUES (v_order_id, v_current_status, v_new_status, auth.uid(), 'Auto-updated based on batch progress');
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on production_schedule_items to auto-update order status
DROP TRIGGER IF EXISTS trigger_auto_update_order_status ON public.production_schedule_items;
CREATE TRIGGER trigger_auto_update_order_status
  AFTER UPDATE OF current_stage
  ON public.production_schedule_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- Function to get production capacity per day
CREATE OR REPLACE FUNCTION public.get_production_capacity(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  schedule_date date,
  total_batches integer,
  available_capacity integer,
  schedule_items jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.schedule_date,
    COALESCE(SUM(psi.batches), 0)::integer as total_batches,
    (12 - COALESCE(SUM(psi.batches), 0))::integer as available_capacity,
    jsonb_agg(
      jsonb_build_object(
        'id', psi.id,
        'formula_code', psi.formula_code,
        'batches', psi.batches,
        'materials_ok', psi.materials_ok,
        'current_stage', psi.current_stage
      )
    ) as schedule_items
  FROM public.production_schedules ps
  LEFT JOIN public.production_schedule_items psi ON psi.schedule_id = ps.id
  WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
  GROUP BY ps.schedule_date
  ORDER BY ps.schedule_date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function to get upcoming material shortages
CREATE OR REPLACE FUNCTION public.get_upcoming_material_shortages(
  p_days_ahead integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_shortages jsonb := '[]'::jsonb;
  v_schedule_item record;
BEGIN
  -- Get all scheduled items in the next p_days_ahead days
  FOR v_schedule_item IN
    SELECT 
      psi.id,
      psi.formula_id,
      psi.batches,
      psi.formula_code,
      ps.schedule_date,
      psi.shortages_json,
      psi.materials_ok
    FROM public.production_schedule_items psi
    JOIN public.production_schedules ps ON ps.id = psi.schedule_id
    WHERE ps.schedule_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_ahead)
    AND psi.materials_ok = false
    ORDER BY ps.schedule_date
  LOOP
    -- Add shortages from this schedule item
    IF v_schedule_item.shortages_json IS NOT NULL AND jsonb_array_length(v_schedule_item.shortages_json) > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(
        jsonb_build_object(
          'schedule_item_id', v_schedule_item.id,
          'formula_code', v_schedule_item.formula_code,
          'schedule_date', v_schedule_item.schedule_date,
          'batches', v_schedule_item.batches,
          'shortages', v_schedule_item.shortages_json
        )
      );
    END IF;
  END LOOP;
  
  v_result := jsonb_build_object(
    'total_items_with_shortages', jsonb_array_length(v_shortages),
    'shortages', v_shortages,
    'checked_at', now()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;