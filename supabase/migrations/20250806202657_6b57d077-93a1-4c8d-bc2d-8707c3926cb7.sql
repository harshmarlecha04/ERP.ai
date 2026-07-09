-- Add foreign key constraint between raw_material_lots and raw_materials
ALTER TABLE raw_material_lots DROP CONSTRAINT IF EXISTS fk_raw_material_lots_raw_material_id;
ALTER TABLE raw_material_lots 
ADD CONSTRAINT fk_raw_material_lots_raw_material_id 
FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE;

-- Add updated_at trigger for raw_materials if it doesn't exist
DROP TRIGGER IF EXISTS update_raw_materials_updated_at ON raw_materials;
CREATE TRIGGER update_raw_materials_updated_at
  BEFORE UPDATE ON raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for raw_material_lots if it doesn't exist  
DROP TRIGGER IF EXISTS update_raw_material_lots_updated_at ON raw_material_lots;
CREATE TRIGGER update_raw_material_lots_updated_at
  BEFORE UPDATE ON raw_material_lots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();