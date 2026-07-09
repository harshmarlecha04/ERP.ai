-- The issue is that the RLS policy on formulas calls validate_formula_access_secure 
-- which calls log_formula_access, which triggers update_formula_access_stats
-- which tries to update the same formulas row being deleted, causing a conflict.

-- Let's fix this by modifying the update policy to not log access during DELETE operations

-- First, let's drop the problematic policy and recreate it without the logging during deletes
DROP POLICY IF EXISTS "Secure multi-layer formula update" ON public.formulas;

-- Create a simpler update policy that doesn't cause circular dependencies
CREATE POLICY "Secure multi-layer formula update" 
ON public.formulas 
FOR UPDATE 
USING (
    -- For soft deletes, only check if user has admin role (simple check, no logging)
    CASE 
        WHEN NEW.is_deleted = true AND OLD.is_deleted = false THEN
            has_role(auth.uid(), 'admin'::app_role)
        ELSE
            validate_formula_access_secure(auth.uid(), id, 'edit'::text)
    END
)
WITH CHECK (
    -- Same logic for WITH CHECK
    CASE 
        WHEN NEW.is_deleted = true AND OLD.is_deleted = false THEN
            has_role(auth.uid(), 'admin'::app_role)
        ELSE
            validate_formula_access_secure(auth.uid(), id, 'edit'::text)
    END
);