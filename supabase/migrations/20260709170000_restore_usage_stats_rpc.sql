-- The frontend calls rpc get_raw_material_usage_stats(); an old security
-- migration dropped it in favor of the raw_material_usage_stats view.
-- Restore it as a thin wrapper over the view (RLS of underlying tables applies).
CREATE OR REPLACE FUNCTION public.get_raw_material_usage_stats()
RETURNS TABLE(
  raw_material_id uuid,
  code text,
  name text,
  supplier text,
  usage_count bigint,
  total_quantity_used numeric,
  last_used_date timestamp with time zone,
  first_used_date timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT raw_material_id, code, name, supplier,
         usage_count, total_quantity_used, last_used_date, first_used_date
  FROM public.raw_material_usage_stats;
$$;
GRANT EXECUTE ON FUNCTION public.get_raw_material_usage_stats() TO authenticated;
