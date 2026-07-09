-- Fix the formulas RLS policy by removing the INSERT operation from SELECT policy
DROP POLICY IF EXISTS "Ultra-secure trade secret formula protection" ON public.formulas;

-- Create a new policy without the logging function call
CREATE POLICY "Secure formula access without logging" 
ON public.formulas 
FOR SELECT 
USING (can_access_trade_secret_formula_secure(auth.uid(), id, 'read'::text));

-- Also fix other policies that might have logging in them
DROP POLICY IF EXISTS "Only R&D managers and admins can insert formulas" ON public.formulas;
DROP POLICY IF EXISTS "Only admins can delete formulas with logging" ON public.formulas;
DROP POLICY IF EXISTS "Strict formula update access" ON public.formulas;

-- Recreate these policies without logging
CREATE POLICY "Only R&D managers and admins can insert formulas" 
ON public.formulas 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete formulas" 
ON public.formulas 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secure formula update access" 
ON public.formulas 
FOR UPDATE 
USING (can_access_specific_formula(auth.uid(), id, 'write'::text))
WITH CHECK (can_access_specific_formula(auth.uid(), id, 'write'::text));