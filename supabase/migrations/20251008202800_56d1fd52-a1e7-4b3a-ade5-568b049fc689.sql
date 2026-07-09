-- Fix formula updates policy to never call validate_formula_access_secure during soft deletes
DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas;

CREATE POLICY "Secure formula updates"
ON public.formulas
FOR UPDATE
USING (
  (NOT is_deleted) OR 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role))
)
WITH CHECK (
  -- Priority 1: Allow admins/rd_managers to soft delete any formula (no security checks)
  (is_deleted = true AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role)))
  OR
  -- Priority 2: For non-delete updates ONLY, apply security level checks
  (is_deleted = false AND (
    (security_level = 'standard'::text AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role)))
    OR
    ((security_level IN ('confidential'::text, 'trade_secret'::text)) AND validate_formula_access_secure(auth.uid(), id, 'edit'::text))
  ))
);