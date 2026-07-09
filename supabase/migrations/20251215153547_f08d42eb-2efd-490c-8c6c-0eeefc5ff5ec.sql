-- Drop existing overly permissive policies on rd_project_actives
DROP POLICY IF EXISTS "All users can view rd_project_actives" ON rd_project_actives;
DROP POLICY IF EXISTS "All users can update rd_project_actives" ON rd_project_actives;
DROP POLICY IF EXISTS "All users can delete rd_project_actives" ON rd_project_actives;
DROP POLICY IF EXISTS "Authenticated users can manage rd_project_actives" ON rd_project_actives;

-- Create restricted SELECT policy - only RD managers and admins
CREATE POLICY "RD managers and admins can view rd_project_actives"
ON rd_project_actives 
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create restricted INSERT policy - only RD managers and admins
CREATE POLICY "RD managers and admins can insert rd_project_actives"
ON rd_project_actives 
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create restricted UPDATE policy - only RD managers and admins
CREATE POLICY "RD managers and admins can update rd_project_actives"
ON rd_project_actives 
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create restricted DELETE policy - only admins
CREATE POLICY "Only admins can delete rd_project_actives"
ON rd_project_actives 
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));