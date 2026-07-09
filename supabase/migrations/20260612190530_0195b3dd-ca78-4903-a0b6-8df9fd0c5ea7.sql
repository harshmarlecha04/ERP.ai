DROP POLICY IF EXISTS "Staff can view roster" ON public.schedule_employees;
DROP POLICY IF EXISTS "Staff can insert roster" ON public.schedule_employees;
DROP POLICY IF EXISTS "Staff can update roster" ON public.schedule_employees;
DROP POLICY IF EXISTS "Staff can view employee schedule" ON public.employee_schedule;

CREATE POLICY "Internal staff can view roster"
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
  );

CREATE POLICY "Internal staff can insert roster"
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
  );

CREATE POLICY "Internal staff can update roster"
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
  );

CREATE POLICY "Internal staff can view employee schedule"
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
  );

NOTIFY pgrst, 'reload schema';