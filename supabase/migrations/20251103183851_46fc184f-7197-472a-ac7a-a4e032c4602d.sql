-- Create rd_project_versions table
CREATE TABLE IF NOT EXISTS rd_project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_project_id UUID NOT NULL REFERENCES rd_projects(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  gummies_count INTEGER,
  scheduled_date DATE,
  flavor TEXT NOT NULL,
  color TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rd_project_id, version_number)
);

-- Create rd_version_actives table
CREATE TABLE IF NOT EXISTS rd_version_actives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES rd_project_versions(id) ON DELETE CASCADE,
  active_name TEXT NOT NULL,
  mg_per_gummy NUMERIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add version tracking to rd_projects
ALTER TABLE rd_projects
ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES rd_project_versions(id),
ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 0;

-- Migrate existing rd_projects to versions
DO $$
DECLARE
  project_record RECORD;
  new_version_id UUID;
  active_record RECORD;
BEGIN
  FOR project_record IN SELECT * FROM rd_projects LOOP
    -- Create v1 version for each project
    INSERT INTO rd_project_versions (
      rd_project_id,
      version_number,
      gummies_count,
      scheduled_date,
      flavor,
      color,
      notes,
      status,
      approved_by,
      approved_at,
      rejected_by,
      rejected_at,
      rejection_reason,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      project_record.id,
      'v1',
      project_record.gummies_count,
      project_record.scheduled_date,
      project_record.flavor,
      project_record.color,
      project_record.notes,
      CASE 
        WHEN project_record.status = 'approved' THEN 'approved'
        WHEN project_record.status = 'rejected' THEN 'rejected'
        ELSE 'pending_approval'
      END,
      project_record.approved_by,
      project_record.approved_at,
      project_record.rejected_by,
      project_record.rejected_at,
      project_record.rejection_reason,
      project_record.created_by,
      project_record.created_at,
      project_record.updated_at
    ) RETURNING id INTO new_version_id;

    -- Migrate actives to version actives
    FOR active_record IN 
      SELECT * FROM rd_project_actives 
      WHERE rd_project_id = project_record.id 
      ORDER BY sort_order 
    LOOP
      INSERT INTO rd_version_actives (
        version_id,
        active_name,
        mg_per_gummy,
        sort_order
      ) VALUES (
        new_version_id,
        active_record.active_name,
        active_record.mg_per_gummy,
        active_record.sort_order
      );
    END LOOP;

    -- Update project with version info
    UPDATE rd_projects
    SET current_version_id = new_version_id,
        version_count = 1
    WHERE id = project_record.id;
  END LOOP;
END $$;

-- RLS policies for rd_project_versions
DO $rls$ BEGIN ALTER TABLE rd_project_versions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can view rd_project_versions"
  ON rd_project_versions FOR SELECT
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can insert rd_project_versions"
  ON rd_project_versions FOR INSERT
  WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can update rd_project_versions"
  ON rd_project_versions FOR UPDATE
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can delete rd_project_versions"
  ON rd_project_versions FOR DELETE
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS policies for rd_version_actives
DO $rls$ BEGIN ALTER TABLE rd_version_actives ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can view rd_version_actives"
  ON rd_version_actives FOR SELECT
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can insert rd_version_actives"
  ON rd_version_actives FOR INSERT
  WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can update rd_version_actives"
  ON rd_version_actives FOR UPDATE
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can delete rd_version_actives"
  ON rd_version_actives FOR DELETE
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;