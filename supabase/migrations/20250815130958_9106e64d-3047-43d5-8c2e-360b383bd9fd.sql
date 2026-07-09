-- Add receiving_date column to raw_material_lots table
ALTER TABLE public.raw_material_lots 
ADD COLUMN IF NOT EXISTS receiving_date DATE;