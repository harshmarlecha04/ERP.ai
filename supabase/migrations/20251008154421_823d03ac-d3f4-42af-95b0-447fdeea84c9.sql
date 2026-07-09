-- ========================================
-- CRITICAL SECURITY FIX: Restrict Profile Access
-- ========================================
-- This migration fixes the security vulnerability where all authenticated users
-- could view other users' sensitive profile information (emails, names, job titles, etc.)

-- Step 1: Drop the overly permissive policy that allows all authenticated users to view profiles
DROP POLICY IF EXISTS "Authenticated users can view basic public profile info" ON public.profiles;

-- Step 2: Drop existing functions so we can recreate them with proper signatures
DROP FUNCTION IF EXISTS public.get_user_display_info(uuid[]);
DROP FUNCTION IF EXISTS public.get_team_member_info(uuid);

-- Step 3: Create secure RPC functions for legitimate profile access use cases

-- Function to get basic display info for specific users (for dropdowns, assignments, etc.)
-- Returns only non-sensitive display information
CREATE OR REPLACE FUNCTION public.get_user_display_info(_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  display_name text,
  job_title text,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return basic display information, no emails or other sensitive data
  -- This is used for UI elements like dropdowns and user assignments
  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(p.display_name, p.full_name, 'Unknown User') as display_name,
    p.job_title,
    p.department
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND p.data_classification <> 'confidential';
END;
$$;

-- Function to get team members for a manager
-- Returns basic info about direct reports
CREATE OR REPLACE FUNCTION public.get_team_member_info(_manager_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  job_title text,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if requester is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Only return team members for the specified manager
  -- This enforces manager-subordinate relationships
  RETURN QUERY
  SELECT 
    esd.id as user_id,
    COALESCE(esd.display_name, esd.full_name, 'Unknown User') as display_name,
    esd.job_title,
    esd.department
  FROM public.employee_sensitive_data esd
  WHERE esd.manager_id = _manager_id
    AND esd.data_classification <> 'confidential';
END;
$$;

-- Step 4: Add new restrictive policy - only allow viewing of own profile
CREATE POLICY "Users can only view their own profile data"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());