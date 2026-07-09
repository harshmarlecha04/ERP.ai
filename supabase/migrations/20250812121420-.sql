-- Add admin-only policy for viewing other users' profiles
-- This allows admins to manage user accounts while keeping regular users restricted to their own profiles

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can see their own profile OR admins can see all profiles
  (auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Add admin-only policy for updating other users' profiles (for user management)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (
  -- Users can update their own profile OR admins can update any profile
  (auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Drop the existing restrictive policies since we're replacing them with more comprehensive ones
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;