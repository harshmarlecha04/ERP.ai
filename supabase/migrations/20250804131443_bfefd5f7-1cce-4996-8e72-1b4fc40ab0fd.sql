-- Add coa_link column to raw_material_lots table
ALTER TABLE raw_material_lots ADD COLUMN IF NOT EXISTS coa_link TEXT;

-- Remove the old coa file columns as they are no longer needed
ALTER TABLE raw_material_lots DROP COLUMN IF EXISTS coa_file_path;
ALTER TABLE raw_material_lots DROP COLUMN IF EXISTS coa_file_name;