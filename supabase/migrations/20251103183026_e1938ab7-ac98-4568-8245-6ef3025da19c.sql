-- Add gummies count and scheduled date to rd_projects table
ALTER TABLE rd_projects
ADD COLUMN gummies_count INTEGER,
ADD COLUMN scheduled_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN rd_projects.gummies_count IS 'Total number of gummies planned for R&D production';
COMMENT ON COLUMN rd_projects.scheduled_date IS 'Scheduled date for R&D production/testing';