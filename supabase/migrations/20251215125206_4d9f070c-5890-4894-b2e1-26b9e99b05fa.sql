-- Drop existing profiles policies that allow public access
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update their own profile display info" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Recreate policies with proper authentication requirements
-- Users can only view their own profile (already exists for authenticated, but let's be explicit)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Admins can view all profiles (restricted to authenticated)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can insert their own profile (restricted to authenticated)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can create own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can update their own profile (restricted to authenticated)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Only admins can delete profiles (restricted to authenticated)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;