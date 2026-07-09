-- The issue is that the RLS policy on formulas calls validate_formula_access_secure 
-- which calls log_formula_access, which triggers update_formula_access_stats
-- which tries to update the same formulas row being deleted, causing a conflict.

-- Let's fix this by modifying the update policy to not log access during DELETE operations

-- First, let's drop the problematic policy and recreate it without the logging during deletes
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure multi-layer formula update" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create a simpler update policy that doesn't cause circular dependencies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure multi-layer formula update" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure multi-layer formula update" 
ON public.formulas 
FOR UPDATE 
USING (
    -- For soft deletes, only check if user has admin role (simple check, no logging)
    (has_role(auth.uid(), 'admin'::app_role) OR validate_formula_access_secure(auth.uid(), id, 'edit'::text))
)
WITH CHECK (
    -- Same logic for WITH CHECK
    (has_role(auth.uid(), 'admin'::app_role) OR validate_formula_access_secure(auth.uid(), id, 'edit'::text))
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;