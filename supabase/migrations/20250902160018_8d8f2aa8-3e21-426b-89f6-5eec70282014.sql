-- Update profiles table policies for full access
DROP POLICY IF EXISTS "Secure profile access with audit trail" ON public.profiles;
DROP POLICY IF EXISTS "Secure profile updates with audit trail" ON public.profiles;
DROP POLICY IF EXISTS "Users can only create their own profile" ON public.profiles;

CREATE POLICY "All authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);