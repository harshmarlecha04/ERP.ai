-- Rename the misleading policy name for clarity
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create a clearer policy name that reflects what it actually does
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;