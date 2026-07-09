-- Update RLS policies for raw_materials table to allow all authenticated users
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage raw materials" ON public.raw_materials; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view raw materials" ON public.raw_materials; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new policy allowing all authenticated users to manage raw materials
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage raw materials" ON public.raw_materials; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage raw materials" 
ON public.raw_materials 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update RLS policies for raw_material_lots table to allow all authenticated users  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage raw material lot" ON public.raw_material_lots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view raw material lots" ON public.raw_material_lots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new policy allowing all authenticated users to manage raw material lots
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage raw material lots" ON public.raw_material_lots; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage raw material lots"
ON public.raw_material_lots
FOR ALL
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;