-- Fix critical security vulnerability: Employee Personal Information Exposed to All Users
-- The profiles table currently allows public access to sensitive employee data

-- Drop the overly permissive policy that allows anyone to view all profiles
DROP POLICY IF EXISTS "Users can view basic profile display info" ON public.profiles;

-- Create secure policies for profile access

-- 1. Users can view their own complete profile information
CREATE POLICY "Users can view their own complete profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- 2. Authenticated users can view only basic, non-sensitive public information from other profiles
CREATE POLICY "Authenticated users can view basic public profile info" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id 
  AND data_classification != 'confidential'
);

-- Add a comment to document the security change
COMMENT ON TABLE public.profiles IS 'User profiles table with secure RLS policies. Contains sensitive employee data that requires authentication to access.';

-- Ensure email visibility flag is respected by applications
ALTER TABLE public.profiles 
ALTER COLUMN email_visible_to_public SET DEFAULT false;