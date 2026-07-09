-- Fix the security issue: Add RLS policies to secure_profiles view
-- First, enable RLS on the secure_profiles view
ALTER VIEW public.secure_profiles SET (security_barrier = true);

-- Create RLS policy for the secure_profiles view
-- Users can only view their own profile data, admins can view all
CREATE POLICY "Secure profiles - self access only" 
ON public.secure_profiles 
FOR SELECT 
USING (
  auth.uid() = id OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Also ensure the view cannot be directly inserted/updated/deleted from
-- This is just for extra security as views typically don't allow these operations anyway
CREATE POLICY "No direct modifications to secure_profiles" 
ON public.secure_profiles 
FOR ALL 
USING (false) 
WITH CHECK (false);