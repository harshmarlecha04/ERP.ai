-- ========================================
-- CRITICAL SECURITY FIX: Restrict Profile Access (Final)
-- ========================================

-- Step 1: Remove the overly permissive policy (if it still exists)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view basic public profile info" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Step 2: Ensure secure RPC functions exist for legitimate use cases
-- Drop and recreate to ensure they have correct signatures

DROP FUNCTION IF EXISTS public.get_user_display_info(uuid[]);
DROP FUNCTION IF EXISTS public.get_team_member_info(uuid);

-- Function to get basic display info for specific users (for dropdowns, assignments, etc.)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_user_display_info' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_team_member_info' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
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

-- Note: The restrictive policy "Users can view their own complete profile" already exists
-- and restricts access so users can only view their own profile data