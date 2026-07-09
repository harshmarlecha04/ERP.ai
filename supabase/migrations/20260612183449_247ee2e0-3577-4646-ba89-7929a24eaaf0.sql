
-- Roster table for non-auth employees used only by scheduling
CREATE TABLE public.schedule_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  default_team text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_employees TO authenticated;
GRANT ALL ON public.schedule_employees TO service_role;

ALTER TABLE public.schedule_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view roster"
  ON public.schedule_employees FOR SELECT
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'customer'));

CREATE POLICY "Admin/HR can insert roster"
  ON public.schedule_employees FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

CREATE POLICY "Admin/HR can update roster"
  ON public.schedule_employees FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

CREATE POLICY "Admin/HR can delete roster"
  ON public.schedule_employees FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));

CREATE TRIGGER update_schedule_employees_updated_at
  BEFORE UPDATE ON public.schedule_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add roster reference to schedule entries (employee_id stays for auth profile users)
ALTER TABLE public.employee_schedule
  ADD COLUMN IF NOT EXISTS roster_employee_id uuid REFERENCES public.schedule_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employee_schedule_roster ON public.employee_schedule(roster_employee_id);
