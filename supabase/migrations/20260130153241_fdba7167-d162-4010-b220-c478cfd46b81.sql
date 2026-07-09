-- Create packaging_schedule table
CREATE TABLE IF NOT EXISTS packaging_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  bottle_item_id UUID REFERENCES packaging_item(id),
  cap_item_id UUID REFERENCES packaging_item(id),
  label_customer_product TEXT,
  count TEXT NOT NULL,
  expected_bottles INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create packaging_completion_records table
CREATE TABLE IF NOT EXISTS packaging_completion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES packaging_schedule(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  bottles_packed INTEGER NOT NULL,
  labels_used INTEGER NOT NULL,
  caps_used INTEGER NOT NULL,
  bottles_used NUMERIC NOT NULL,
  bright_stock_qty INTEGER DEFAULT 0,
  bright_stock_id UUID REFERENCES bright_stock(id),
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for packaging_schedule
DO $rls$ BEGIN ALTER TABLE packaging_schedule ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging_schedule" ON packaging_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view packaging_schedule"
  ON packaging_schedule FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create packaging_schedule" ON packaging_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create packaging_schedule"
  ON packaging_schedule FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update packaging_schedule" ON packaging_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update packaging_schedule"
  ON packaging_schedule FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete packaging_schedule" ON packaging_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete packaging_schedule"
  ON packaging_schedule FOR DELETE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS policies for packaging_completion_records
DO $rls$ BEGIN ALTER TABLE packaging_completion_records ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging_completion_records" ON packaging_completion_records; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view packaging_completion_records"
  ON packaging_completion_records FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create packaging_completion_records" ON packaging_completion_records; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create packaging_completion_records"
  ON packaging_completion_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update packaging_completion_records" ON packaging_completion_records; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update packaging_completion_records"
  ON packaging_completion_records FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete packaging_completion_records" ON packaging_completion_records; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete packaging_completion_records"
  ON packaging_completion_records FOR DELETE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create updated_at trigger function if not exists
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for packaging_schedule
DROP TRIGGER IF EXISTS update_packaging_schedule_updated_at ON packaging_schedule;
CREATE TRIGGER update_packaging_schedule_updated_at
  BEFORE UPDATE ON packaging_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();