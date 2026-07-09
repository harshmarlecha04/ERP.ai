-- Fix security issues from the previous migration
-- Recreate the view with proper security settings
DROP VIEW IF EXISTS public.raw_material_usage_stats;

CREATE OR REPLACE VIEW public.raw_material_usage_stats 
WITH (security_invoker=true) AS
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