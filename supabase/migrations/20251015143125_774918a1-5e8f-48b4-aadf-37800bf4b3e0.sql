-- Add density column to raw_materials table for volume-to-weight conversions
ALTER TABLE public.raw_materials 
ADD COLUMN IF NOT EXISTS density_kg_per_l NUMERIC(10, 4) NULL;

COMMENT ON COLUMN public.raw_materials.density_kg_per_l IS 'Material density in kg per liter, used for volume-to-weight unit conversions. Example: Water=1.0, Oil=0.92, Honey=1.4';