-- Add formula reference link column to rd_projects table
ALTER TABLE rd_projects
ADD COLUMN formula_reference_link TEXT;

-- Add comment for documentation
COMMENT ON COLUMN rd_projects.formula_reference_link IS 'Optional link to Dropbox, Google Drive, or other storage for R&D formula documentation';