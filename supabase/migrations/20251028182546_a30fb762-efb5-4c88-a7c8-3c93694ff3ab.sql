-- Drop the existing trigger
DROP TRIGGER IF EXISTS cleanup_inventory_on_session_delete ON inventory_update_sessions;

-- Drop existing foreign key constraints
ALTER TABLE inventory_update_session_items
  DROP CONSTRAINT IF EXISTS inventory_update_session_items_movement_id_fkey;

ALTER TABLE inventory_update_session_items
  DROP CONSTRAINT IF EXISTS inventory_update_session_items_label_inventory_id_fkey;

-- Recreate with ON DELETE CASCADE
ALTER TABLE inventory_update_session_items
  ADD CONSTRAINT inventory_update_session_items_movement_id_fkey
  FOREIGN KEY (movement_id) REFERENCES packaging_movement(id) ON DELETE CASCADE;

ALTER TABLE inventory_update_session_items
  ADD CONSTRAINT inventory_update_session_items_label_inventory_id_fkey
  FOREIGN KEY (label_inventory_id) REFERENCES label_inventory(id) ON DELETE CASCADE;

-- Recreate the trigger (it will work correctly now)
CREATE TRIGGER cleanup_inventory_on_session_delete
  BEFORE DELETE ON inventory_update_sessions
  FOR EACH ROW
  EXECUTE FUNCTION delete_session_inventory_records();