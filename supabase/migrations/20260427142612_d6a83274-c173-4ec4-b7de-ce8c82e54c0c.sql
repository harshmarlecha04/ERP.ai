CREATE TABLE IF NOT EXISTS public.rd_color_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $rls$ BEGIN ALTER TABLE public.rd_color_options ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view color options" ON public.rd_color_options; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view color options"
ON public.rd_color_options
FOR SELECT
TO authenticated
USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can add color options" ON public.rd_color_options; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can add color options"
ON public.rd_color_options
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;