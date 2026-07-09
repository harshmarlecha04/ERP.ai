-- Create inventory update sessions table
CREATE TABLE inventory_update_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  item_count INTEGER DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0
);

-- Create session items tracking table
CREATE TABLE inventory_update_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES inventory_update_sessions(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES packaging_movement(id) ON DELETE SET NULL,
  label_inventory_id UUID REFERENCES label_inventory(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('PACKAGING', 'LABEL')),
  item_name TEXT NOT NULL,
  quantity_deducted NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT has_reference CHECK (
    (movement_id IS NOT NULL AND label_inventory_id IS NULL) OR
    (movement_id IS NULL AND label_inventory_id IS NOT NULL)
  )
);

-- Add indexes
CREATE INDEX idx_sessions_created_by ON inventory_update_sessions(created_by);
CREATE INDEX idx_sessions_date ON inventory_update_sessions(session_date);
CREATE INDEX idx_session_items_session ON inventory_update_session_items(session_id);

-- Enable RLS
ALTER TABLE inventory_update_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_update_session_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions"
  ON inventory_update_sessions FOR SELECT
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

CREATE POLICY "Users can create sessions"
  ON inventory_update_sessions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own sessions"
  ON inventory_update_sessions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own sessions"
  ON inventory_update_sessions FOR DELETE
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- RLS Policies for session items
CREATE POLICY "Users can view session items"
  ON inventory_update_session_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM inventory_update_sessions s
    WHERE s.id = session_id AND (s.created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    ))
  ));

CREATE POLICY "Users can create session items"
  ON inventory_update_session_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM inventory_update_sessions s
    WHERE s.id = session_id AND s.created_by = auth.uid()
  ));

-- Add deletion hook to clean up actual inventory records
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cleanup_inventory_on_session_delete
  BEFORE DELETE ON inventory_update_sessions
  FOR EACH ROW
  EXECUTE FUNCTION delete_session_inventory_records();