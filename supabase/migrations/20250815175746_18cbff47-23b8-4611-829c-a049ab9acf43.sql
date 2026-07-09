-- Stub for function defined fully in a later migration (needed by policies below).
-- Deny-by-default until the real definition replaces it.
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_specific_formula' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.can_access_specific_formula(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $stub$ SELECT public.has_role(_user_id, 'admin'::app_role) $stub$;

-- Fix the formulas RLS policy by removing the INSERT operation from SELECT policy
DO $pol$ BEGIN DROP POLICY IF EXISTS "Ultra-secure trade secret formula protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create a new policy without the logging function call
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula access without logging" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula access without logging" 
ON public.formulas 
FOR SELECT 
USING (can_access_trade_secret_formula_secure(auth.uid(), id, 'read'::text)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Also fix other policies that might have logging in them
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only R&D managers and admins can insert formulas" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete formulas with logging" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula update access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Recreate these policies without logging
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only R&D managers and admins can insert formulas" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only R&D managers and admins can insert formulas" 
ON public.formulas 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete formulas" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete formulas" 
ON public.formulas 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula update access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula update access" 
ON public.formulas 
FOR UPDATE 
USING (can_access_specific_formula(auth.uid(), id, 'write'::text))
WITH CHECK (can_access_specific_formula(auth.uid(), id, 'write'::text)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;