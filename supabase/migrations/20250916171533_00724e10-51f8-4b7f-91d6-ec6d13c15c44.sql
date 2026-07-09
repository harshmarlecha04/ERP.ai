-- Update RLS policy to allow all authenticated users to manage inventory thresholds
DROP POLICY IF EXISTS "Admins and procurement can manage inventory thresholds" ON public.inventory_thresholds;

CREATE POLICY "All authenticated users can manage inventory thresholds"
ON public.inventory_thresholds
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);