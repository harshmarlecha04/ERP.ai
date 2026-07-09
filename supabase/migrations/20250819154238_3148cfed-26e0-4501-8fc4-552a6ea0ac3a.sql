-- Add archive functionality to raw_materials table
ALTER TABLE public.raw_materials 
ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN archived_at timestamp with time zone,
ADD COLUMN archived_by uuid;

-- Create index for efficient filtering of archived materials
CREATE INDEX idx_raw_materials_is_archived ON public.raw_materials(is_archived);

-- Create view for material usage statistics
CREATE OR REPLACE VIEW public.raw_material_usage_stats AS
SELECT 
  rm.id as raw_material_id,
  rm.code,
  rm.name,
  rm.supplier,
  COUNT(piu.id) as usage_count,
  COALESCE(SUM(piu.actual_quantity_kg), 0) as total_quantity_used,
  MAX(piu.usage_date) as last_used_date,
  MIN(piu.usage_date) as first_used_date
FROM public.raw_materials rm
LEFT JOIN public.production_ingredient_usage piu ON piu.raw_material_id = rm.id
GROUP BY rm.id, rm.code, rm.name, rm.supplier;