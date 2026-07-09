
-- Enums
DO $$ BEGIN
  CREATE TYPE public.schedule_team AS ENUM ('manufacturing','coating','packaging','qa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.schedule_building AS ENUM ('17_west','282_ridgedale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.schedule_entry_type AS ENUM ('shift','leave');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.schedule_leave_type AS ENUM ('furlough','pto','sick','unpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.employee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  entry_type public.schedule_entry_type NOT NULL,
  team public.schedule_team,
  building public.schedule_building,
  start_time time,
  end_time time,
  leave_type public.schedule_leave_type,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_requires_team_building CHECK (
    entry_type <> 'shift' OR (team IS NOT NULL AND building IS NOT NULL)
  ),
  CONSTRAINT leave_requires_type CHECK (
    entry_type <> 'leave' OR leave_type IS NOT NULL
  ),
  CONSTRAINT time_order CHECK (
    start_time IS NULL OR end_time IS NULL OR end_time > start_time
  )
);

CREATE INDEX employee_schedule_date_idx ON public.employee_schedule(date);
CREATE INDEX employee_schedule_emp_date_idx ON public.employee_schedule(employee_id, date);
CREATE INDEX employee_schedule_team_date_idx ON public.employee_schedule(team, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_schedule TO authenticated;
GRANT ALL ON public.employee_schedule TO service_role;

ALTER TABLE public.employee_schedule ENABLE ROW LEVEL SECURITY;

-- Any authenticated staff (non-customer) may view
CREATE POLICY "Staff can view employee schedule"
ON public.employee_schedule FOR SELECT TO authenticated
USING (NOT public.has_role(auth.uid(), 'customer'));

-- Only admin / hr_manager can write
CREATE POLICY "Admin/HR can insert schedule"
ON public.employee_schedule FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
);

CREATE POLICY "Admin/HR can update schedule"
ON public.employee_schedule FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
);

CREATE POLICY "Admin/HR can delete schedule"
ON public.employee_schedule FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_employee_schedule_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER employee_schedule_updated_at
BEFORE UPDATE ON public.employee_schedule
FOR EACH ROW EXECUTE FUNCTION public.tg_employee_schedule_updated_at();
