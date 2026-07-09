ALTER TABLE public.rd_projects ADD COLUMN IF NOT EXISTS mold_size text;
ALTER TABLE public.rd_project_versions ADD COLUMN IF NOT EXISTS mold_size text;