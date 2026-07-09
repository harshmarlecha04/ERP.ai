-- Fix security definer view issue by replacing view with a security invoker function
-- This eliminates the security definer concern completely

-- Drop the existing view that's causing the security issue
DROP VIEW IF EXISTS public.inventory_lots_view;

-- Create a security invoker function instead of a view
-- This will use the caller's permissions, not the definer's
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_inventory_lots' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_inventory_lots()
RETURNS TABLE(
  id uuid,
  ingredient_id uuid,
  ingredient_name text,
  qty_on_hand_kg numeric,
  qty_reserved_kg numeric,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY INVOKER  -- This is the key - uses caller's permissions
SET search_path = public
AS $$
  SELECT 
    rml.id,
    rml.raw_material_id as ingredient_id,
    rm.name as ingredient_name,
    rml.quantity as qty_on_hand_kg,
    rml.qty_reserved_kg,
    rml.created_at
  FROM public.raw_material_lots rml
  JOIN public.raw_materials rm ON rm.id = rml.raw_material_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_inventory_lots() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_inventory_lots() IS 'Returns inventory lots data using caller permissions (SECURITY INVOKER) to avoid security definer issues';