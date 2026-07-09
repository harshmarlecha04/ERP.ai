
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

CREATE TABLE IF NOT EXISTS public.employee_schedule (
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

CREATE INDEX IF NOT EXISTS employee_schedule_date_idx ON public.employee_schedule(date);
CREATE INDEX IF NOT EXISTS employee_schedule_emp_date_idx ON public.employee_schedule(employee_id, date);
CREATE INDEX IF NOT EXISTS employee_schedule_team_date_idx ON public.employee_schedule(team, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_schedule TO authenticated;
GRANT ALL ON public.employee_schedule TO service_role;
DO $rls$ BEGIN ALTER TABLE public.employee_schedule ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Any authenticated staff (non-customer) may view
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can view employee schedule" ON public.employee_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can view employee schedule"
ON public.employee_schedule FOR SELECT TO authenticated
USING (NOT public.has_role(auth.uid(), 'customer')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Only admin / hr_manager can write
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin/HR can insert schedule" ON public.employee_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admin/HR can insert schedule"
ON public.employee_schedule FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin/HR can update schedule" ON public.employee_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admin/HR can update schedule"
ON public.employee_schedule FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admin/HR can delete schedule" ON public.employee_schedule; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admin/HR can delete schedule"
ON public.employee_schedule FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager')
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- updated_at trigger
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='tg_employee_schedule_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.tg_employee_schedule_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS employee_schedule_updated_at ON public.employee_schedule;
CREATE TRIGGER employee_schedule_updated_at
BEFORE UPDATE ON public.employee_schedule
FOR EACH ROW EXECUTE FUNCTION public.tg_employee_schedule_updated_at();
