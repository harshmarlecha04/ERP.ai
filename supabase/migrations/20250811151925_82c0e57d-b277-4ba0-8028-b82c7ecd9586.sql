-- Fix Security Definer View warning
-- The inventory_lots view is using SECURITY DEFINER which can be a security risk
-- Replace it with a standard view or function

-- Drop the existing view if it exists
DROP VIEW IF EXISTS public.inventory_lots;

-- Create a secure function instead to get inventory lots data
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_inventory_lots' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_inventory_lots()
RETURNS TABLE (
  id uuid,
  ingredient_id uuid,
  ingredient_name text,
  qty_on_hand_kg numeric,
  qty_reserved_kg numeric,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY INVOKER -- Use INVOKER instead of DEFINER for better security
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

-- Alternative: Create a proper view without SECURITY DEFINER
CREATE OR REPLACE VIEW public.inventory_lots_view AS
SELECT 
  rml.id,
  rml.raw_material_id as ingredient_id,
  rm.name as ingredient_name,
  rml.quantity as qty_on_hand_kg,
  rml.qty_reserved_kg,
  rml.created_at
FROM public.raw_material_lots rml
JOIN public.raw_materials rm ON rm.id = rml.raw_material_id;

-- Enable RLS on the view (though it inherits from underlying tables)
-- Views don't directly support RLS, but the underlying tables do

-- Grant permissions
GRANT SELECT ON public.inventory_lots_view TO authenticated;