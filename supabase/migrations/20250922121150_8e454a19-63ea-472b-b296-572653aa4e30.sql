-- Fix RLS policy for formula soft deletion
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create updated policy that allows soft deletion
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula updates" ON public.formulas
FOR UPDATE 
USING (
  -- Can update if formula is not deleted OR if user has admin/rd_manager role (for soft delete)
  (NOT is_deleted) OR 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role))
)
WITH CHECK (
  -- Standard formulas: admin or rd_manager can update
  -- Confidential/trade_secret: need special access validation
  (
    (security_level = 'standard' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role))) OR
    (security_level IN ('confidential', 'trade_secret') AND validate_formula_access_secure(auth.uid(), id, 'edit'))
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;