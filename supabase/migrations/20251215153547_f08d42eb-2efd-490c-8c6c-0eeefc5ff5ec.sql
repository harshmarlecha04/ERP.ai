-- Drop existing overly permissive policies on rd_project_actives
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create restricted SELECT policy - only RD managers and admins
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_project_actives"
ON rd_project_actives 
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create restricted INSERT policy - only RD managers and admins
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can insert rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can insert rd_project_actives"
ON rd_project_actives 
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create restricted UPDATE policy - only RD managers and admins
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_project_actives"
ON rd_project_actives 
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create restricted DELETE policy - only admins
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_project_actives" ON rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_project_actives"
ON rd_project_actives 
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;