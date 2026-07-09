-- Fix security definer view issue by dropping and recreating inventory_lots_view
-- without SECURITY DEFINER to ensure it uses the querying user's permissions

-- Drop the existing view
DROP VIEW IF EXISTS public.inventory_lots_view;

-- Recreate the view without SECURITY DEFINER (uses INVOKER rights by default)
CREATE OR REPLACE VIEW public.inventory_lots_view AS
SELECT 
  rml.id,
  rml.raw_material_id AS ingredient_id,
  rm.name AS ingredient_name,
  rml.quantity AS qty_on_hand_kg,
  rml.qty_reserved_kg,
  rml.created_at
FROM public.raw_material_lots rml
JOIN public.raw_materials rm ON rm.id = rml.raw_material_id;

-- Grant appropriate permissions to authenticated users
GRANT SELECT ON public.inventory_lots_view TO authenticated;