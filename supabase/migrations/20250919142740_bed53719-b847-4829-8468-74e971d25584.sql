-- Temporarily update RLS policies to allow admin users to create formulas
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula creation" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula creation" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula creation" 
ON public.formulas 
FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'rd_manager'::app_role)
    )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;