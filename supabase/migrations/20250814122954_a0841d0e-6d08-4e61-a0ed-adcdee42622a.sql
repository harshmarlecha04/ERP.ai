-- Fix RLS policies for raw materials access
-- The current policies are too restrictive for general inventory access

-- Drop and recreate raw_materials policies with more appropriate access
DROP POLICY IF EXISTS "Production and procurement can view raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Only admins and production managers can manage raw materials" ON public.raw_materials;

-- Allow authenticated users to view raw materials (read-only for most users)
CREATE POLICY "Authenticated users can view raw materials" 
ON public.raw_materials 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only admins and production managers can modify raw materials
CREATE POLICY "Only admins and production managers can manage raw materials" 
ON public.raw_materials 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role));

-- Drop and recreate raw_material_lots policies with more appropriate access
DROP POLICY IF EXISTS "Production and procurement can view raw material lots" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Only admins and production managers can manage raw material lot" ON public.raw_material_lots;

-- Allow authenticated users to view raw material lots (read-only for most users)
CREATE POLICY "Authenticated users can view raw material lots" 
ON public.raw_material_lots 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only admins and production managers can modify raw material lots
CREATE POLICY "Only admins and production managers can manage raw material lots" 
ON public.raw_material_lots 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role));