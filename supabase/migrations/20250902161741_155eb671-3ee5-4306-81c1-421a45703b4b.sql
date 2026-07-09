-- CRITICAL PRIVACY FIX: Implement strict privacy controls for employee personal data

-- Drop all overly permissive profile policies
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "All authenticated users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "All authenticated users can create profiles" ON public.profiles;

-- Implement strict privacy protection - users can only access their own profile data
CREATE POLICY "Users can only view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can only see their own profile
  id = auth.uid() OR
  -- Admins can view profiles for legitimate HR/management purposes
  has_role(auth.uid(), 'admin'::app_role)
);

-- Users can only update their own profile
CREATE POLICY "Users can only update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Users can only create their own profile (linked to their auth ID)
CREATE POLICY "Users can only create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Profile ID must match the authenticated user's ID
  id = auth.uid()
);

-- Only admins can delete profiles (for account cleanup/GDPR compliance)
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));