
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.launch_phase AS ENUM ('Formulation','Manufacturing','Regulatory','Packaging','Marketing','Distribution');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.launch_status AS ENUM ('todo','in_progress','blocked','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.launch_priority AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.launch_project_status AS ENUM ('planning','active','on_hold','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ updated_at helper (reuse if exists) ============
CREATE OR REPLACE FUNCTION public.launch_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PRODUCT LINES ============
CREATE TABLE public.launch_product_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#2F6DF6',
  target_launch_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_product_lines TO authenticated;
GRANT ALL ON public.launch_product_lines TO service_role;
ALTER TABLE public.launch_product_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read product lines" ON public.launch_product_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert product lines" ON public.launch_product_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update product lines" ON public.launch_product_lines FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete product lines" ON public.launch_product_lines FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_launch_product_lines_uat BEFORE UPDATE ON public.launch_product_lines FOR EACH ROW EXECUTE FUNCTION public.launch_set_updated_at();

-- ============ PROJECTS ============
CREATE TABLE public.launch_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id UUID REFERENCES public.launch_product_lines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status public.launch_project_status NOT NULL DEFAULT 'planning',
  priority public.launch_priority NOT NULL DEFAULT 'medium',
  owner_id UUID,
  start_date DATE,
  target_date DATE,
  color TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_projects TO authenticated;
GRANT ALL ON public.launch_projects TO service_role;
ALTER TABLE public.launch_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read projects" ON public.launch_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert projects" ON public.launch_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update projects" ON public.launch_projects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin or owner delete projects" ON public.launch_projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR owner_id = auth.uid());
CREATE INDEX idx_launch_projects_line ON public.launch_projects(product_line_id);
CREATE TRIGGER trg_launch_projects_uat BEFORE UPDATE ON public.launch_projects FOR EACH ROW EXECUTE FUNCTION public.launch_set_updated_at();

-- ============ TASKS ============
CREATE TABLE public.launch_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  product_line_id UUID REFERENCES public.launch_product_lines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  phase public.launch_phase NOT NULL DEFAULT 'Formulation',
  status public.launch_status NOT NULL DEFAULT 'todo',
  priority public.launch_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID,
  start_date DATE,
  due_date DATE,
  position INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_tasks TO authenticated;
GRANT ALL ON public.launch_tasks TO service_role;
ALTER TABLE public.launch_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tasks" ON public.launch_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert tasks" ON public.launch_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update tasks" ON public.launch_tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin or owner delete tasks" ON public.launch_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid() OR assignee_id = auth.uid());
CREATE INDEX idx_launch_tasks_project ON public.launch_tasks(project_id);
CREATE INDEX idx_launch_tasks_assignee ON public.launch_tasks(assignee_id);
CREATE TRIGGER trg_launch_tasks_uat BEFORE UPDATE ON public.launch_tasks FOR EACH ROW EXECUTE FUNCTION public.launch_set_updated_at();

-- ============ TASK UPDATES (timeline / comments) ============
CREATE TABLE public.launch_task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.launch_tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_task_updates TO authenticated;
GRANT ALL ON public.launch_task_updates TO service_role;
ALTER TABLE public.launch_task_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read updates" ON public.launch_task_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert updates" ON public.launch_task_updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own update updates" ON public.launch_task_updates FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "own or admin delete updates" ON public.launch_task_updates FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_launch_task_updates_task ON public.launch_task_updates(task_id);

-- ============ ATTACHMENTS (task or project) ============
CREATE TABLE public.launch_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.launch_tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (task_id IS NOT NULL OR project_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_attachments TO authenticated;
GRANT ALL ON public.launch_attachments TO service_role;
ALTER TABLE public.launch_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read attachments" ON public.launch_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert attachments" ON public.launch_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "own or admin delete attachments" ON public.launch_attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_launch_attachments_task ON public.launch_attachments(task_id);
CREATE INDEX idx_launch_attachments_project ON public.launch_attachments(project_id);

-- ============ MILESTONES ============
CREATE TABLE public.launch_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.launch_projects(id) ON DELETE CASCADE,
  product_line_id UUID REFERENCES public.launch_product_lines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_milestones TO authenticated;
GRANT ALL ON public.launch_milestones TO service_role;
ALTER TABLE public.launch_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read milestones" ON public.launch_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write milestones" ON public.launch_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update milestones" ON public.launch_milestones FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete milestones" ON public.launch_milestones FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ============ SEED PRODUCT LINES ============
INSERT INTO public.launch_product_lines (name, color) VALUES
  ('Capsules', '#2F6DF6'),
  ('Softgels', '#16A34A'),
  ('Gummies',  '#EA580C')
ON CONFLICT (name) DO NOTHING;
