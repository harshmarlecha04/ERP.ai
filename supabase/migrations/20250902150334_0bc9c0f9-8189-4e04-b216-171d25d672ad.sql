-- First remove the problematic foreign key constraint  
ALTER TABLE public.formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_formula_id_fkey;

-- Update RLS policies to remove log_formula_access calls that are blocking operations
DROP POLICY IF EXISTS "Strict formula ingredients insert" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Strict formula ingredients update" ON public.formula_ingredients;  
DROP POLICY IF EXISTS "Strict formula ingredients delete" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Secure formula updates with audit" ON public.formulas;

-- Recreate simpler policies without the problematic logging calls
CREATE POLICY "Strict formula ingredients insert" ON public.formula_ingredients
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  has_role(auth.uid(), 'formulation_scientist'::app_role)
);

CREATE POLICY "Strict formula ingredients update" ON public.formula_ingredients  
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  has_role(auth.uid(), 'formulation_scientist'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  has_role(auth.uid(), 'formulation_scientist'::app_role)
);

CREATE POLICY "Strict formula ingredients delete" ON public.formula_ingredients
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secure formula updates with audit" ON public.formulas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  has_role(auth.uid(), 'formulation_scientist'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  has_role(auth.uid(), 'formulation_scientist'::app_role)
);