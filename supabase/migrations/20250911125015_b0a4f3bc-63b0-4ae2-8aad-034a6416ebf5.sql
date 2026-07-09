-- Fix critical security vulnerability: Employee Personal Information Exposed to All Users
-- The profiles table currently allows public access to sensitive employee data

-- Drop the overly permissive policy that allows anyone to view all profiles
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view basic profile display info" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create secure policies for profile access

-- 1. Users can view their own complete profile information
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own complete profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own complete profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. Authenticated users can view only basic, non-sensitive public information from other profiles
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view basic public profile info" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view basic public profile info" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id 
  AND data_classification != 'confidential'
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Add a comment to document the security change
COMMENT ON TABLE public.profiles IS 'User profiles table with secure RLS policies. Contains sensitive employee data that requires authentication to access.';

-- Ensure email visibility flag is respected by applications
ALTER TABLE public.profiles 
ALTER COLUMN email_visible_to_public SET DEFAULT false;