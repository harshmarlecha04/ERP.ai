-- Update RLS policies for raw_materials table to allow all authenticated users
DROP POLICY IF EXISTS "Only admins and production managers can manage raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Authenticated users can view raw materials" ON public.raw_materials;

-- Create new policy allowing all authenticated users to manage raw materials
CREATE POLICY "Authenticated users can manage raw materials" 
ON public.raw_materials 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update RLS policies for raw_material_lots table to allow all authenticated users  
DROP POLICY IF EXISTS "Only admins and production managers can manage raw material lot" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Authenticated users can view raw material lots" ON public.raw_material_lots;

-- Create new policy allowing all authenticated users to manage raw material lots
CREATE POLICY "Authenticated users can manage raw material lots"
ON public.raw_material_lots
FOR ALL
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL);