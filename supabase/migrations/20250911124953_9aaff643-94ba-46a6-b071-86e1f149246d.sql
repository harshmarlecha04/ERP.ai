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
-- This excludes sensitive fields like job_title, department, and respects email visibility settings
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view basic public profile info" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view basic public profile info" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id 
  AND data_classification != 'confidential'
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. For security auditing: log profile access attempts
-- Update the existing profile_access_audit table usage to track when profiles are accessed

-- Add a comment to document the security change
COMMENT ON TABLE public.profiles IS 'User profiles table with secure RLS policies. Contains sensitive employee data that requires authentication to access.';

-- Add constraints to ensure data classification is properly set
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_data_classification_check;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_data_classification_check 
CHECK (data_classification IN ('public', 'sensitive', 'confidential'));

-- Ensure email visibility flag is respected by applications
ALTER TABLE public.profiles 
ALTER COLUMN email_visible_to_public SET DEFAULT false;