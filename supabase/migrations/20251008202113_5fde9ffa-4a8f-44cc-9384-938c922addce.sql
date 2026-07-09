-- Update the formula updates policy to allow admins/rd_managers to soft delete any formula
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula updates"
ON public.formulas
FOR UPDATE
USING (
  (NOT is_deleted) OR 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role))
)
WITH CHECK (
  -- Allow admins/rd_managers to soft delete any formula
  (is_deleted = true AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role)))
  OR
  -- Existing conditions for regular updates
  (
    (security_level = 'standard'::text AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role)))
    OR
    ((security_level = ANY (ARRAY['confidential'::text, 'trade_secret'::text])) AND validate_formula_access_secure(auth.uid(), id, 'edit'::text))
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;