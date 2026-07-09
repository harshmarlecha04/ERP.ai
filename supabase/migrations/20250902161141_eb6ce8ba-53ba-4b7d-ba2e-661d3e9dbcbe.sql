-- CRITICAL FIX: Secure proprietary formulas from unauthorized access

-- Drop all overly permissive formula policies
DROP POLICY IF EXISTS "All authenticated users can view formulas" ON public.formulas;
DROP POLICY IF EXISTS "All authenticated users can insert formulas" ON public.formulas;
DROP POLICY IF EXISTS "All authenticated users can update formulas" ON public.formulas;
DROP POLICY IF EXISTS "All authenticated users can delete formulas" ON public.formulas;

-- Implement strict role-based access for trade secret protection
-- Only authorized R&D and admin personnel can access formulas

CREATE POLICY "Only authorized personnel can view formulas"
ON public.formulas
FOR SELECT
TO authenticated
USING (
  (NOT is_deleted) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
  )
);

CREATE POLICY "Only R&D and admin can create formulas"
ON public.formulas
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only R&D and admin can update formulas"
ON public.formulas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only admin can delete formulas"
ON public.formulas
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));