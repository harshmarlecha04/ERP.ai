CREATE TABLE IF NOT EXISTS public.rd_flavor_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_flavor_options TO authenticated;
GRANT ALL ON public.rd_flavor_options TO service_role;
DO $rls$ BEGIN ALTER TABLE public.rd_flavor_options ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can read flavor options" ON public.rd_flavor_options; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can read flavor options"
  ON public.rd_flavor_options FOR SELECT
  TO authenticated
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert flavor options" ON public.rd_flavor_options; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can insert flavor options"
  ON public.rd_flavor_options FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;