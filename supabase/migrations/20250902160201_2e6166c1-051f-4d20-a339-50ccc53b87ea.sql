-- Fix critical security vulnerability: Restrict user role management to admins only (corrected syntax)

-- Drop the overly permissive policies I created
DROP POLICY IF EXISTS "All authenticated users can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "All authenticated users can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "All authenticated users can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "All authenticated users can delete user roles" ON public.user_roles;

-- Restore secure policies for user_roles table with separate policies for each operation
CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles and admins can view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));