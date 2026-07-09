-- Add client_name to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name text;

-- Add linked_module to project_tasks table for future integration
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS linked_module text;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.client_name IS 'Client or customer name associated with this project';
COMMENT ON COLUMN public.project_tasks.linked_module IS 'Module this task is linked to: production, purchasing, costing, rd';