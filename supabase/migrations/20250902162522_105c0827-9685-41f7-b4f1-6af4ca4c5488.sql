-- Fix purchase orders visibility: Allow all authenticated users to view purchase orders
-- while maintaining appropriate restrictions on modifications

-- Update the SELECT policy to allow all authenticated users to view purchase orders
DROP POLICY IF EXISTS "Only authorized roles can view purchase orders" ON public.purchase_orders;

CREATE POLICY "All authenticated users can view purchase orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Keep existing restrictions for create/update/delete operations
-- (Only admins and production managers can modify purchase orders)