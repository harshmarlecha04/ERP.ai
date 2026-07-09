-- Temporarily update RLS policies to allow admin users to create formulas
DROP POLICY IF EXISTS "Secure formula creation" ON public.formulas;

CREATE POLICY "Secure formula creation" 
ON public.formulas 
FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'rd_manager'::app_role)
    )
);