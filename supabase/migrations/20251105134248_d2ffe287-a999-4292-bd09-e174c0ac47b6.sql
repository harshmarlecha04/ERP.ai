-- Update the trigger function to also create purchase history records
CREATE OR REPLACE FUNCTION handle_fulfilled_request()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id UUID;
  v_category TEXT := 'General';
  v_unit_of_measure TEXT;
BEGIN
  -- Only process when status changes to 'fulfilled'
  IF NEW.status = 'fulfilled' AND (OLD.status IS NULL OR OLD.status != 'fulfilled') THEN
    
    -- Get unit of measure from request, or default to 'units'
    v_unit_of_measure := COALESCE(NEW.unit_of_measure, 'units');
    
    -- Try to find existing item by name (case-insensitive)
    SELECT id INTO v_item_id
    FROM office_supplies
    WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(NEW.item_name))
    LIMIT 1;
    
    IF v_item_id IS NULL THEN
      -- Item doesn't exist, create it
      INSERT INTO office_supplies (
        item_name,
        category,
        quantity_on_hand,
        unit_of_measure,
        created_by,
        notes
      ) VALUES (
        NEW.item_name,
        v_category,
        NEW.quantity_requested,
        v_unit_of_measure,
        NEW.fulfilled_by,
        'Auto-created from request #' || NEW.id
      )
      RETURNING id INTO v_item_id;
      
    ELSE
      -- Item exists, update quantity
      UPDATE office_supplies
      SET 
        quantity_on_hand = quantity_on_hand + NEW.quantity_requested,
        updated_at = NOW()
      WHERE id = v_item_id;
      
    END IF;
    
    -- Update the request to link to the inventory item
    NEW.item_id := v_item_id;
    
    -- Create transaction record
    INSERT INTO office_supply_transactions (
      item_id,
      transaction_type,
      quantity,
      performed_by,
      notes
    ) VALUES (
      v_item_id,
      'purchase',
      NEW.quantity_requested,
      NEW.fulfilled_by,
      'From fulfilled request: ' || NEW.item_name
    );
    
    -- Create purchase history record
    INSERT INTO office_supply_purchases (
      item_id,
      purchase_date,
      quantity,
      unit_cost,
      shipping_cost,
      tax,
      total_cost,
      supplier,
      notes,
      created_by
    ) VALUES (
      v_item_id,
      COALESCE(NEW.fulfilled_at, NOW()),
      NEW.quantity_requested,
      0,
      0,
      0,
      0,
      'Internal Fulfillment',
      'Fulfilled from internal request: ' || NEW.item_name,
      NEW.fulfilled_by
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add purchase history records for existing fulfilled requests
DO $$
DECLARE
  req RECORD;
BEGIN
  -- Loop through all fulfilled requests that have an item_id but no purchase record
  FOR req IN 
    SELECT osr.* 
    FROM office_supply_requests osr
    WHERE osr.status = 'fulfilled' 
      AND osr.item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM office_supply_purchases 
        WHERE item_id = osr.item_id 
        AND notes LIKE '%Fulfilled from internal request%'
      )
  LOOP
    
    -- Create purchase history record
    INSERT INTO office_supply_purchases (
      item_id,
      purchase_date,
      quantity,
      unit_cost,
      shipping_cost,
      tax,
      total_cost,
      supplier,
      notes,
      created_by
    ) VALUES (
      req.item_id,
      COALESCE(req.fulfilled_at, NOW()),
      req.quantity_requested,
      0,
      0,
      0,
      0,
      'Internal Fulfillment',
      'Fulfilled from internal request (retroactive): ' || req.item_name,
      req.fulfilled_by
    );
    
  END LOOP;
END $$;