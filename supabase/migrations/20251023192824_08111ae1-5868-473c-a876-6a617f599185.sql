-- Create order_delivery_milestones table
CREATE TABLE IF NOT EXISTS order_delivery_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES order_headers(id) ON DELETE CASCADE,
  line_item_id UUID REFERENCES order_line_items(id) ON DELETE CASCADE,
  milestone_number INTEGER NOT NULL,
  target_bottles INTEGER NOT NULL,
  shipped_bottles INTEGER DEFAULT 0,
  target_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_milestones_order ON order_delivery_milestones(order_id);
CREATE INDEX IF NOT EXISTS idx_milestones_line_item ON order_delivery_milestones(line_item_id);

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE order_delivery_milestones ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS Policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view milestones" ON order_delivery_milestones; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view milestones"
  ON order_delivery_milestones FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create milestones" ON order_delivery_milestones; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create milestones"
  ON order_delivery_milestones FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update milestones" ON order_delivery_milestones; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update milestones"
  ON order_delivery_milestones FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete milestones" ON order_delivery_milestones; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete milestones"
  ON order_delivery_milestones FOR DELETE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create function to automatically update updated_at timestamp
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_milestone_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION update_milestone_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_milestones_updated_at ON order_delivery_milestones;
CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON order_delivery_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_updated_at();