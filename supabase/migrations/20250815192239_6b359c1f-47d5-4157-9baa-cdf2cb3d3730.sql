-- Create atomic completion function for production schedules
CREATE OR REPLACE FUNCTION complete_schedule(
  p_schedule_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule record;
  v_formula record;
  v_ingredient record;
  v_lot record;
  v_required_qty numeric;
  v_remaining_qty numeric;
  v_deducted_qty numeric;
  v_available_qty numeric;
  v_error_message text;
BEGIN
  -- Lock the schedule row for update
  SELECT psi.*, ps.schedule_date 
  INTO v_schedule
  FROM production_schedule_items psi
  JOIN production_schedules ps ON ps.id = psi.schedule_id
  WHERE psi.id = p_schedule_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schedule not found'
    );
  END IF;
  
  -- Check if already completed
  IF EXISTS (SELECT 1 FROM batch_records WHERE schedule_id = p_schedule_id AND status = 'completed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch already completed'
    );
  END IF;
  
  -- Get formula details
  SELECT * INTO v_formula
  FROM formulas
  WHERE id = v_schedule.formula_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Formula not found'
    );
  END IF;
  
  -- Process each ingredient in the formula
  FOR v_ingredient IN
    SELECT 
      (ingredient_rec.ingredient_id)::uuid as raw_material_id,
      ingredient_rec.ingredient_name as name,
      ingredient_rec.qty_per_batch_kg::numeric as qty_per_batch_kg
    FROM jsonb_to_recordset(COALESCE(v_formula.recipe_json, '[]'::jsonb)) AS ingredient_rec(
      ingredient_id text,
      ingredient_name text,
      qty_per_batch_kg numeric
    )
  LOOP
    -- Calculate total required quantity
    v_required_qty := v_ingredient.qty_per_batch_kg * v_schedule.batches;
    v_remaining_qty := v_required_qty;
    
    -- Check total available quantity first
    SELECT COALESCE(SUM(quantity), 0) INTO v_available_qty
    FROM raw_material_lots
    WHERE raw_material_id = v_ingredient.raw_material_id
    AND quantity > 0;
    
    IF v_available_qty < v_required_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Insufficient inventory for %s. Needed %s kg, available %s kg. Completion cancelled.',
          v_ingredient.name, v_required_qty, v_available_qty)
      );
    END IF;
    
    -- FEFO lot picking: process lots by expiry date, then creation date
    FOR v_lot IN
      SELECT *
      FROM raw_material_lots
      WHERE raw_material_id = v_ingredient.raw_material_id
      AND quantity > 0
      ORDER BY 
        COALESCE(expires_on, '2099-12-31'::date) ASC,
        created_at ASC
    LOOP
      EXIT WHEN v_remaining_qty <= 0;
      
      -- Calculate how much to deduct from this lot
      v_deducted_qty := LEAST(v_remaining_qty, v_lot.quantity);
      
      -- Update lot quantity
      UPDATE raw_material_lots
      SET quantity = quantity - v_deducted_qty,
          updated_at = now()
      WHERE id = v_lot.id;
      
      -- Record inventory movement
      INSERT INTO inventory_reservations (
        lot_id,
        schedule_item_id,
        reserved_kg
      ) VALUES (
        v_lot.id,
        p_schedule_id,
        v_deducted_qty
      );
      
      -- Decrease remaining quantity
      v_remaining_qty := v_remaining_qty - v_deducted_qty;
    END LOOP;
    
    -- Final check - should not happen due to pre-check, but safety measure
    IF v_remaining_qty > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Could not allocate sufficient %s inventory. Missing %s kg.',
          v_ingredient.name, v_remaining_qty)
      );
    END IF;
  END LOOP;
  
  -- Create batch record
  INSERT INTO batch_records (
    id,
    schedule_id,
    status,
    completed_at,
    completed_by
  ) VALUES (
    gen_random_uuid(),
    p_schedule_id,
    'completed',
    now(),
    p_user_id
  )
  ON CONFLICT (schedule_id) DO UPDATE SET
    status = 'completed',
    completed_at = now(),
    completed_by = p_user_id;
  
  -- Update production schedule status
  UPDATE production_schedules
  SET status = 'completed',
      updated_at = now()
  WHERE id = v_schedule.schedule_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Batch completed successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Database error: %s', SQLERRM)
    );
END;
$$;

-- Create batch_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS batch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'completed',
  completed_at timestamp with time zone,
  completed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (schedule_id) REFERENCES production_schedule_items(id) ON DELETE CASCADE
);

-- Enable RLS on batch_records
ALTER TABLE batch_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for batch_records
CREATE POLICY "Only admins and production managers can manage batch records"
ON batch_records
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_batch_records_updated_at
  BEFORE UPDATE ON batch_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();