-- Add foreign key constraint between raw_material_lots and raw_materials
ALTER TABLE raw_material_lots 
ADD CONSTRAINT fk_raw_material_lots_raw_material_id 
FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE;