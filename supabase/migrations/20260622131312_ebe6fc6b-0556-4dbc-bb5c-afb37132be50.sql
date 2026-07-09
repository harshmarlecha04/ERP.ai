CREATE TABLE IF NOT EXISTS public.rd_version_inactives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.rd_project_versions(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_version_inactives TO authenticated;
GRANT ALL ON public.rd_version_inactives TO service_role;
DO $rls$ BEGIN ALTER TABLE public.rd_version_inactives ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_version_inactives" ON public.rd_version_inactives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_version_inactives"
ON public.rd_version_inactives FOR SELECT
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can create rd_version_inactives" ON public.rd_version_inactives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can create rd_version_inactives"
ON public.rd_version_inactives FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_version_inactives" ON public.rd_version_inactives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_version_inactives"
ON public.rd_version_inactives FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_version_inactives" ON public.rd_version_inactives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_version_inactives"
ON public.rd_version_inactives FOR DELETE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rd_manager')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

CREATE INDEX IF NOT EXISTS idx_rd_version_inactives_version_id ON public.rd_version_inactives(version_id);