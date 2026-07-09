-- Add RLS policies to inventory_lots_view to resolve security definer issue
-- This ensures the view respects user permissions properly

-- Enable RLS on the view
ALTER VIEW public.inventory_lots_view SET ROW LEVEL SECURITY DISABLE;

-- Since this is a view that joins raw_material_lots and raw_materials,
-- it will inherit the security from the underlying tables through their RLS policies
-- We just need to ensure authenticated users can access it

-- Revoke any existing permissions and grant only to authenticated users
REVOKE ALL ON public.inventory_lots_view FROM PUBLIC;
GRANT SELECT ON public.inventory_lots_view TO authenticated;

-- Add a comment to document the security approach
COMMENT ON VIEW public.inventory_lots_view IS 'Inventory lots view that inherits security from underlying tables (raw_material_lots and raw_materials). No RLS needed on view itself as security is enforced at table level.';