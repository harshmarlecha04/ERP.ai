DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin/HR can insert roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin/HR can update roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin/HR can delete roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can insert roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can insert roster"
  ON public.schedule_employees FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'customer')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can update roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can update roster"
  ON public.schedule_employees FOR UPDATE
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'customer'))
  WITH CHECK (NOT public.has_role(auth.uid(), 'customer')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin can delete roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admin can delete roster"
  ON public.schedule_employees FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

NOTIFY pgrst, 'reload schema';