-- Fix purchase orders visibility: Allow all authenticated users to view purchase orders
-- while maintaining appropriate restrictions on modifications

-- Update the SELECT policy to allow all authenticated users to view purchase orders
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only authorized roles can view purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view purchase orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Keep existing restrictions for create/update/delete operations
-- (Only admins and production managers can modify purchase orders)