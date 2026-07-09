-- Update RLS policy to allow all authenticated users to manage inventory thresholds
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins and procurement can manage inventory thresholds" ON public.inventory_thresholds; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can manage inventory thresholds" ON public.inventory_thresholds; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can manage inventory thresholds"
ON public.inventory_thresholds
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;