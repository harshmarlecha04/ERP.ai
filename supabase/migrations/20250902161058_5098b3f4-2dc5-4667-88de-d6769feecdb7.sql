-- CRITICAL FIX: Secure formula ingredients from unauthorized access

-- Drop all overly permissive formula ingredients policies
DROP POLICY IF EXISTS "All authenticated users can view formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "All authenticated users can insert formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "All authenticated users can update formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "All authenticated users can delete formula ingredients" ON public.formula_ingredients;

-- Implement strict role-based access for formula ingredient trade secrets
CREATE POLICY "Only authorized personnel can view formula ingredients"
ON public.formula_ingredients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only R&D and admin can create formula ingredients"
ON public.formula_ingredients
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only R&D and admin can update formula ingredients"
ON public.formula_ingredients
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

CREATE POLICY "Only admin can delete formula ingredients"
ON public.formula_ingredients
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));