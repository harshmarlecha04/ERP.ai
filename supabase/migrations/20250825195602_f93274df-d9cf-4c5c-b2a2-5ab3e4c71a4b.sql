-- Update RLS policies for inventory_reservations table
DROP POLICY IF EXISTS "Only admins and production managers can manage inventory reserv" ON public.inventory_reservations;
DROP POLICY IF EXISTS "Production managers can view inventory reservations" ON public.inventory_reservations; 

-- Create new policy allowing all authenticated users to manage inventory reservations
CREATE POLICY "Authenticated users can manage inventory reservations"
ON public.inventory_reservations
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update RLS policies for production_ingredient_usage table
DROP POLICY IF EXISTS "Only admins and production managers can manage ingredient usage" ON public.production_ingredient_usage;

-- Create new policy allowing all authenticated users to manage ingredient usage
CREATE POLICY "Authenticated users can manage ingredient usage"
ON public.production_ingredient_usage  
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update RLS policies for suppliers table (material suppliers)
DROP POLICY IF EXISTS "Only admins and production managers can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Procurement and finance can view suppliers" ON public.suppliers;

-- Create new policy allowing all authenticated users to manage suppliers
CREATE POLICY "Authenticated users can manage suppliers"
ON public.suppliers
FOR ALL  
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);