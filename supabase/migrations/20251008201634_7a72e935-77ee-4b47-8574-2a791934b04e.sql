-- Update the formula deletion policy to allow both admin and rd_manager roles
DROP POLICY IF EXISTS "Secure formula deletion" ON public.formulas;

CREATE POLICY "Secure formula deletion"
ON public.formulas
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role)
);