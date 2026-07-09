-- Make supplier optional in raw_materials table
ALTER TABLE public.raw_materials 
ALTER COLUMN supplier DROP NOT NULL;

-- Make lot_number optional in raw_material_lots table  
ALTER TABLE public.raw_material_lots 
ALTER COLUMN lot_number DROP NOT NULL;