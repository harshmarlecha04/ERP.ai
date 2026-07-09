-- Remove security definer property from inventory_lots_view to fix security linter warning
DROP VIEW IF EXISTS public.inventory_lots_view;

-- Recreate the view without SECURITY DEFINER
CREATE VIEW public.inventory_lots_view AS
SELECT 
  rml.id,
  rml.raw_material_id as ingredient_id,
  rm.name as ingredient_name,
  rml.quantity as qty_on_hand_kg,
  rml.qty_reserved_kg,
  rml.created_at
FROM public.raw_material_lots rml
JOIN public.raw_materials rm ON rm.id = rml.raw_material_id;