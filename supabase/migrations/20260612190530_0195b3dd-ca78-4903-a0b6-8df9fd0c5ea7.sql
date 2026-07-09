DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can view roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can insert roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can update roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can view employee schedule" ON public.employee_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Internal staff can view roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Internal staff can view roster"
  ON public.schedule_employees FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr_manager')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
    OR public.has_role(auth.uid(), 'rd_manager')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role <> 'customer'
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Internal staff can insert roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Internal staff can insert roster"
  ON public.schedule_employees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr_manager')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
    OR public.has_role(auth.uid(), 'rd_manager')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role <> 'customer'
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Internal staff can update roster" ON public.schedule_employees; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Internal staff can update roster"
  ON public.schedule_employees FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr_manager')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
    OR public.has_role(auth.uid(), 'rd_manager')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role <> 'customer'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr_manager')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
    OR public.has_role(auth.uid(), 'rd_manager')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role <> 'customer'
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Internal staff can view employee schedule" ON public.employee_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Internal staff can view employee schedule"
  ON public.employee_schedule FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr_manager')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
    OR public.has_role(auth.uid(), 'rd_manager')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role <> 'customer'
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

NOTIFY pgrst, 'reload schema';