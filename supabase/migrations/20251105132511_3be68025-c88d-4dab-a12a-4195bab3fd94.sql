-- One-time script to process existing fulfilled requests that weren't handled by trigger
DO $$
DECLARE
  req RECORD;
  v_item_id UUID;
  v_category TEXT := 'General';
BEGIN
  -- Loop through all fulfilled requests that don't have an item_id
  FOR req IN 
    SELECT * FROM office_supply_requests 
    WHERE status = 'fulfilled' AND item_id IS NULL
  LOOP
    
    -- Try to find existing item by name (case-insensitive)
    SELECT id INTO v_item_id
    FROM office_supplies
    WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(req.item_name))
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
        req.item_name,
        v_category,
        req.quantity_requested,
        COALESCE(req.unit_of_measure, 'units'),
        req.fulfilled_by,
        'Auto-created from fulfilled request (retroactive)'
      )
      RETURNING id INTO v_item_id;
      
    ELSE
      -- Item exists, update quantity
      UPDATE office_supplies
      SET 
        quantity_on_hand = quantity_on_hand + req.quantity_requested,
        updated_at = NOW()
      WHERE id = v_item_id;
      
    END IF;
    
    -- Update the request to link to the inventory item
    UPDATE office_supply_requests
    SET item_id = v_item_id
    WHERE id = req.id;
    
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
      req.quantity_requested,
      req.fulfilled_by,
      'From fulfilled request (retroactive): ' || req.item_name
    );
    
  END LOOP;
END $$;