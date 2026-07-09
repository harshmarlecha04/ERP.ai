-- Create projects table
CREATE TABLE public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'General',
    status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    start_date date,
    due_date date,
    completed_at timestamp with time zone,
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    budget numeric,
    tags text[] DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create project_tasks table
CREATE TABLE public.project_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date date,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create project_comments table
CREATE TABLE public.project_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    task_id uuid REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Create project_members table
CREATE TABLE public.project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
    added_at timestamp with time zone DEFAULT now(),
    UNIQUE (project_id, user_id)
);

-- Create sequence for project numbers
CREATE SEQUENCE IF NOT EXISTS project_number_seq START 1;

-- Function to generate project number
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.project_number := 'PRJ-' || LPAD(nextval('project_number_seq')::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating project number
CREATE TRIGGER set_project_number
    BEFORE INSERT ON public.projects
    FOR EACH ROW
    WHEN (NEW.project_number IS NULL)
    EXECUTE FUNCTION generate_project_number();

-- Update timestamp trigger
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
    BEFORE UPDATE ON public.project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Admins and production managers can manage all projects"
ON public.projects FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'production_manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'production_manager'));

CREATE POLICY "Users can view projects they own or are members of"
ON public.projects FOR SELECT
USING (
    owner_id = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update projects they own"
ON public.projects FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- RLS Policies for project_tasks
CREATE POLICY "Admins can manage all tasks"
ON public.project_tasks FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'production_manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'production_manager'));

CREATE POLICY "Project members can manage tasks"
ON public.project_tasks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = project_tasks.project_id
        AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = project_tasks.project_id
        AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
);

-- RLS Policies for project_comments
CREATE POLICY "Admins can manage all comments"
ON public.project_comments FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Project members can view and add comments"
ON public.project_comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = project_comments.project_id
        AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
);

CREATE POLICY "Users can add comments to their projects"
ON public.project_comments FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.id = project_comments.project_id
        AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
);

CREATE POLICY "Users can delete own comments"
ON public.project_comments FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for project_members
CREATE POLICY "Admins can manage all members"
ON public.project_members FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'production_manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'production_manager'));

CREATE POLICY "Project owners can manage members"
ON public.project_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
);

CREATE POLICY "Members can view project members"
ON public.project_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid()
    )
);

-- Create indexes for performance
CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_assigned ON public.project_tasks(assigned_to);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_comments_project ON public.project_comments(project_id);