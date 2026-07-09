
-- ============ EXTEND MILESTONES ============
ALTER TABLE public.launch_milestones
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_off_by UUID,
  ADD COLUMN IF NOT EXISTS signed_off_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.launch_milestones
  DROP CONSTRAINT IF EXISTS launch_milestones_status_check;
ALTER TABLE public.launch_milestones DROP CONSTRAINT IF EXISTS launch_milestones_status_check;
ALTER TABLE public.launch_milestones
  ADD CONSTRAINT launch_milestones_status_check
  CHECK (status IN ('pending','ready_for_signoff','done','at_risk'));

DROP TRIGGER IF EXISTS trg_launch_milestones_uat ON public.launch_milestones;
DROP TRIGGER IF EXISTS trg_launch_milestones_uat ON public.launch_milestones;
CREATE TRIGGER trg_launch_milestones_uat BEFORE UPDATE ON public.launch_milestones
  FOR EACH ROW EXECUTE FUNCTION public.launch_set_updated_at();

-- Link milestones to tasks (auto-flip to ready_for_signoff when all linked tasks done)
CREATE TABLE IF NOT EXISTS public.launch_milestone_tasks (
  milestone_id UUID NOT NULL REFERENCES public.launch_milestones(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.launch_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_milestone_tasks TO authenticated;
GRANT ALL ON public.launch_milestone_tasks TO service_role;
DO $rls$ BEGIN ALTER TABLE public.launch_milestone_tasks ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read mtasks" ON public.launch_milestone_tasks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth read mtasks" ON public.launch_milestone_tasks FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth write mtasks" ON public.launch_milestone_tasks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth write mtasks" ON public.launch_milestone_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth delete mtasks" ON public.launch_milestone_tasks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth delete mtasks" ON public.launch_milestone_tasks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============ PROJECT CHARTER (1:1 with project) ============
CREATE TABLE IF NOT EXISTS public.launch_charters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  executive_sponsor_id UUID,
  project_owner_id UUID,
  business_case TEXT,
  objectives TEXT,
  in_scope TEXT,
  out_of_scope TEXT,
  success_criteria TEXT,
  budget_amount NUMERIC(14,2),
  budget_currency TEXT NOT NULL DEFAULT 'USD',
  assumptions TEXT,
  constraints TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_charters TO authenticated;
GRANT ALL ON public.launch_charters TO service_role;
DO $rls$ BEGIN ALTER TABLE public.launch_charters ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read charters" ON public.launch_charters; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth read charters" ON public.launch_charters FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth insert charters" ON public.launch_charters; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth insert charters" ON public.launch_charters FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth update charters" ON public.launch_charters; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth update charters" ON public.launch_charters FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth delete charters" ON public.launch_charters; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth delete charters" ON public.launch_charters FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DROP TRIGGER IF EXISTS trg_launch_charters_uat ON public.launch_charters;
CREATE TRIGGER trg_launch_charters_uat BEFORE UPDATE ON public.launch_charters
  FOR EACH ROW EXECUTE FUNCTION public.launch_set_updated_at();

-- ============ RACI STAKEHOLDERS ============
CREATE TABLE IF NOT EXISTS public.launch_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  user_id UUID,
  external_name TEXT,
  external_email TEXT,
  workstream TEXT NOT NULL DEFAULT 'General',
  raci CHAR(1) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT launch_stakeholders_raci_check CHECK (raci IN ('R','A','C','I')),
  CONSTRAINT launch_stakeholders_who_chk CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_stakeholders TO authenticated;
GRANT ALL ON public.launch_stakeholders TO service_role;
DO $rls$ BEGIN ALTER TABLE public.launch_stakeholders ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read stk" ON public.launch_stakeholders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth read stk" ON public.launch_stakeholders FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth insert stk" ON public.launch_stakeholders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth insert stk" ON public.launch_stakeholders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth update stk" ON public.launch_stakeholders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth update stk" ON public.launch_stakeholders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth delete stk" ON public.launch_stakeholders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth delete stk" ON public.launch_stakeholders FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
CREATE INDEX IF NOT EXISTS idx_launch_stk_project ON public.launch_stakeholders(project_id);

-- ============ RISK REGISTER (3x3) ============
CREATE TABLE IF NOT EXISTS public.launch_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  likelihood SMALLINT NOT NULL DEFAULT 2,
  impact SMALLINT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'open',
  owner_id UUID,
  mitigation TEXT,
  contingency TEXT,
  due_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT launch_risks_likelihood_chk CHECK (likelihood BETWEEN 1 AND 3),
  CONSTRAINT launch_risks_impact_chk CHECK (impact BETWEEN 1 AND 3),
  CONSTRAINT launch_risks_status_chk CHECK (status IN ('open','mitigating','closed','accepted'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_risks TO authenticated;
GRANT ALL ON public.launch_risks TO service_role;
DO $rls$ BEGIN ALTER TABLE public.launch_risks ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read risks" ON public.launch_risks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth read risks" ON public.launch_risks FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth insert risks" ON public.launch_risks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth insert risks" ON public.launch_risks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth update risks" ON public.launch_risks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth update risks" ON public.launch_risks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth delete risks" ON public.launch_risks; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth delete risks" ON public.launch_risks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
CREATE INDEX IF NOT EXISTS idx_launch_risks_project ON public.launch_risks(project_id);
DROP TRIGGER IF EXISTS trg_launch_risks_uat ON public.launch_risks;
CREATE TRIGGER trg_launch_risks_uat BEFORE UPDATE ON public.launch_risks
  FOR EACH ROW EXECUTE FUNCTION public.launch_set_updated_at();

-- ============ STATUS SNAPSHOTS ============
CREATE TABLE IF NOT EXISTS public.launch_status_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  health TEXT NOT NULL DEFAULT 'on_track',
  percent_complete SMALLINT NOT NULL DEFAULT 0,
  accomplishments TEXT,
  next_steps TEXT,
  blockers TEXT,
  open_risks_count INTEGER NOT NULL DEFAULT 0,
  milestones_done INTEGER NOT NULL DEFAULT 0,
  milestones_total INTEGER NOT NULL DEFAULT 0,
  captured_by UUID,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT launch_snap_health_chk CHECK (health IN ('on_track','at_risk','off_track')),
  CONSTRAINT launch_snap_pct_chk CHECK (percent_complete BETWEEN 0 AND 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_status_snapshots TO authenticated;
GRANT ALL ON public.launch_status_snapshots TO service_role;
DO $rls$ BEGIN ALTER TABLE public.launch_status_snapshots ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read snap" ON public.launch_status_snapshots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth read snap" ON public.launch_status_snapshots FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth insert snap" ON public.launch_status_snapshots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth insert snap" ON public.launch_status_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth update snap" ON public.launch_status_snapshots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth update snap" ON public.launch_status_snapshots FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth delete snap" ON public.launch_status_snapshots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth delete snap" ON public.launch_status_snapshots FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
CREATE INDEX IF NOT EXISTS idx_launch_snap_project ON public.launch_status_snapshots(project_id, captured_at DESC);

-- ============ WEEKLY STATUS REMINDER (via notifications table) ============
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='launch_weekly_status_reminder' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.launch_weekly_status_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.name, COALESCE(c.project_owner_id, p.owner_id) AS owner_id
    FROM public.launch_projects p
    LEFT JOIN public.launch_charters c ON c.project_id = p.id
    WHERE p.status IN ('planning','active')
      AND COALESCE(c.project_owner_id, p.owner_id) IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      r.owner_id,
      'Weekly status update due',
      'Capture this week''s status snapshot for ' || r.name,
      'launch_status_reminder',
      '/launch/projects/' || r.id::text
    );
  END LOOP;
END;
$$;
