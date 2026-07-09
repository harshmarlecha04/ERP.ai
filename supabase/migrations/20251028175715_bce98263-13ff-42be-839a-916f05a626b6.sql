-- Fix search_path for delete_session_inventory_records function
CREATE OR REPLACE FUNCTION delete_session_inventory_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete packaging movements
  DELETE FROM packaging_movement
  WHERE id IN (
    SELECT movement_id FROM inventory_update_session_items
    WHERE session_id = OLD.id AND movement_id IS NOT NULL
  );
  
  -- Delete label inventory records
  DELETE FROM label_inventory
  WHERE id IN (
    SELECT label_inventory_id FROM inventory_update_session_items
    WHERE session_id = OLD.id AND label_inventory_id IS NOT NULL
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;