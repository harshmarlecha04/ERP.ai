-- CRITICAL PRIVACY FIX: Implement strict privacy controls for employee personal data

-- Drop all overly permissive profile policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can update profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can create profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Implement strict privacy protection - users can only access their own profile data
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can only view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can only see their own profile
  id = auth.uid() OR
  -- Admins can view profiles for legitimate HR/management purposes
  has_role(auth.uid(), 'admin'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can only update their own profile
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can only update their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can only update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can only create their own profile (linked to their auth ID)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can only create their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can only create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Profile ID must match the authenticated user's ID
  id = auth.uid()
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Only admins can delete profiles (for account cleanup/GDPR compliance)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;