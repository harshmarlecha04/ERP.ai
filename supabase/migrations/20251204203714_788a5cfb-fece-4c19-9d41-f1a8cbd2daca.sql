-- Fix L-Theanine lot assignment: Move lot 20250630209 (25 kg) from Organic Ginger Root Powder to L-Theanine
UPDATE raw_material_lots 
SET raw_material_id = 'd2b0b345-aa3b-43e0-a3ec-1bfc4254a452'
WHERE id = '64c7d5f5-345b-4035-961e-d9af40d1b97e'
  AND lot_number = '20250630209';