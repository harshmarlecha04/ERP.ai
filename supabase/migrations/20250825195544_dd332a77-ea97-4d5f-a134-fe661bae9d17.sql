-- Update RLS policies for inventory_reservations table
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage inventory reserv" ON public.inventory_reservations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Production managers can view inventory reservations" ON public.inventory_reservations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$; 

-- Create new policy allowing all authenticated users to manage inventory reservations
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage inventory reservations" ON public.inventory_reservations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage inventory reservations"
ON public.inventory_reservations
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update RLS policies for production_ingredient_usage table
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage ingredient usage" ON public.production_ingredient_usage; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new policy allowing all authenticated users to manage ingredient usage
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage ingredient usage" ON public.production_ingredient_usage; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage ingredient usage"
ON public.production_ingredient_usage  
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update RLS policies for suppliers table (material suppliers)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage suppliers" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Procurement and finance can view suppliers" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new policy allowing all authenticated users to manage suppliers
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage suppliers"
ON public.suppliers
FOR ALL  
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;