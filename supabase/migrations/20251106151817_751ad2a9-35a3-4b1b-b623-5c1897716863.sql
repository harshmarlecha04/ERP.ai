-- Add project_name column with temporary default for existing records
ALTER TABLE rd_projects 
ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT 'Untitled Project';

-- Update existing projects to have a meaningful name (customer + flavor)
UPDATE rd_projects 
SET project_name = customer_name || ' - ' || 
  COALESCE(
    (SELECT flavor FROM rd_project_versions 
     WHERE rd_project_versions.rd_project_id = rd_projects.id 
     ORDER BY created_at ASC LIMIT 1),
    'Project'
  );

-- Remove default so future inserts must provide project_name
ALTER TABLE rd_projects 
ALTER COLUMN project_name DROP DEFAULT;