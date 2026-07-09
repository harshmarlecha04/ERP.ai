-- Update all RLS policies to allow all authenticated users full access (corrected)

-- Update formulas table policies
DROP POLICY IF EXISTS "Only R&D managers and admins can insert formulas" ON public.formulas;
DROP POLICY IF EXISTS "Only admins can delete formulas" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula updates with audit" ON public.formulas;
DROP POLICY IF EXISTS "Trade secret formulas require explicit access" ON public.formulas;

CREATE POLICY "All authenticated users can view formulas"
ON public.formulas
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND NOT is_deleted);

CREATE POLICY "All authenticated users can insert formulas"
ON public.formulas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update formulas"
ON public.formulas
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete formulas"
ON public.formulas
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update user_roles table policies  
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "All authenticated users can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);