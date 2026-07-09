
DROP TABLE IF EXISTS public.project_comments CASCADE;
DROP TABLE IF EXISTS public.project_tasks CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

ALTER TABLE public.launch_projects ADD COLUMN IF NOT EXISTS code TEXT;
