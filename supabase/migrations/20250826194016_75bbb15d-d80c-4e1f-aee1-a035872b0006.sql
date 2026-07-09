-- Create table to track completed batch deductions
CREATE TABLE public.completed_batch_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_item_id UUID NOT NULL,
  formula_code TEXT NOT NULL,
  formula_name TEXT NOT NULL,
  batch_count INTEGER NOT NULL,
  total_produced_qty NUMERIC NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'deducted',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track individual ingredient deductions for undo capability
CREATE TABLE public.ingredient_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  completed_batch_id UUID NOT NULL REFERENCES public.completed_batch_deductions(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL,
  ingredient_name TEXT NOT NULL,
  supplier_name TEXT,
  lot_id UUID,
  lot_number TEXT,
  deducted_quantity_kg NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.completed_batch_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_deductions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can manage completed batch deductions"
  ON public.completed_batch_deductions
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage ingredient deductions"
  ON public.ingredient_deductions
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to deduct inventory and record the transaction
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_batch(
  p_schedule_item_id UUID,
  p_formula_code TEXT,
  p_formula_name TEXT,
  p_batch_count INTEGER,
  p_total_produced_qty NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usage_record RECORD;
  v_completed_batch_id UUID;
  v_current_lot_qty NUMERIC;
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
    -- Get current lot quantity if lot_id exists
    IF v_usage_record.lot_id IS NOT NULL THEN
      SELECT quantity INTO v_current_lot_qty
      FROM public.raw_material_lots
      WHERE id = v_usage_record.lot_id;
      
      -- Check if sufficient quantity available
      IF v_current_lot_qty < v_usage_record.actual_quantity_kg THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', format('Insufficient quantity in lot %s. Available: %s kg, Required: %s kg', 
            v_usage_record.lot_number, v_current_lot_qty, v_usage_record.actual_quantity_kg)
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
      (SELECT name FROM public.raw_materials WHERE id = v_usage_record.raw_material_id),
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
$$;

-- Create function to undo inventory deduction
CREATE OR REPLACE FUNCTION public.undo_inventory_deduction(p_completed_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deduction_record RECORD;
  v_result JSONB := '{"success": true, "message": "Deduction reversed successfully"}'::JSONB;
BEGIN
  -- Validate user permissions
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN '{"success": false, "error": "Insufficient permissions"}'::JSONB;
  END IF;
  
  -- Check if batch exists and is in deducted status
  IF NOT EXISTS (
    SELECT 1 FROM public.completed_batch_deductions 
    WHERE id = p_completed_batch_id AND status = 'deducted'
  ) THEN
    RETURN '{"success": false, "error": "Batch not found or already reversed"}'::JSONB;
  END IF;
  
  -- Restore quantities to lots
  FOR v_deduction_record IN
    SELECT * FROM public.ingredient_deductions 
    WHERE completed_batch_id = p_completed_batch_id
  LOOP
    IF v_deduction_record.lot_id IS NOT NULL THEN
      UPDATE public.raw_material_lots
      SET quantity = quantity + v_deduction_record.deducted_quantity_kg,
          updated_at = now()
      WHERE id = v_deduction_record.lot_id;
    END IF;
  END LOOP;
  
  -- Update batch status to reversed
  UPDATE public.completed_batch_deductions
  SET status = 'reversed',
      updated_at = now()
  WHERE id = p_completed_batch_id;
  
  RETURN v_result;
END;
$$;