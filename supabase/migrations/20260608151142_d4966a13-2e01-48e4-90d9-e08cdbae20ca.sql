
ALTER TABLE public.launch_tasks
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.launch_tasks SET status = 'review' WHERE status = 'blocked';

CREATE TABLE IF NOT EXISTS public.launch_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_project_members TO authenticated;
GRANT ALL ON public.launch_project_members TO service_role;
DO $rls$ BEGIN ALTER TABLE public.launch_project_members ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read project members" ON public.launch_project_members; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth read project members" ON public.launch_project_members; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth read project members" ON public.launch_project_members
  FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "auth insert project members" ON public.launch_project_members; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "auth insert project members" ON public.launch_project_members; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "auth insert project members" ON public.launch_project_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "owner or admin delete project members" ON public.launch_project_members; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "owner or admin delete project members" ON public.launch_project_members; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "owner or admin delete project members" ON public.launch_project_members
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.launch_projects p
      WHERE p.id = project_id AND (p.owner_id = auth.uid() OR p.created_by = auth.uid())
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

CREATE INDEX IF NOT EXISTS idx_launch_project_members_project ON public.launch_project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_launch_project_members_user ON public.launch_project_members(user_id);
