-- Create a secure function to access raw material usage statistics
-- This replaces direct access to the view with permission-controlled access
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has required permissions
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view usage statistics';
  END IF;
  
  -- Return the usage statistics data
  RETURN QUERY
  SELECT 
    rmus.raw_material_id,
    rmus.code,
    rmus.name,
    rmus.supplier,
    rmus.usage_count,
    rmus.total_quantity_used,
    rmus.last_used_date,
    rmus.first_used_date
  FROM public.raw_material_usage_stats rmus;
END;
$$;