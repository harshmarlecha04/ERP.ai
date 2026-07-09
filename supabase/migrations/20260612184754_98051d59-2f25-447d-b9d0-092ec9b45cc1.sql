DROP POLICY IF EXISTS "Admin/HR can insert roster" ON public.schedule_employees;
DROP POLICY IF EXISTS "Admin/HR can update roster" ON public.schedule_employees;
DROP POLICY IF EXISTS "Admin/HR can delete roster" ON public.schedule_employees;

CREATE POLICY "Staff can insert roster"
  ON public.schedule_employees FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'customer'));

CREATE POLICY "Staff can update roster"
  ON public.schedule_employees FOR UPDATE
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'customer'))
  WITH CHECK (NOT public.has_role(auth.uid(), 'customer'));

CREATE POLICY "Admin can delete roster"
  ON public.schedule_employees FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';