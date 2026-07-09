-- Fix Employee Personal Data Exposure Security Issue
-- Drop insecure views and replace with properly secured access methods

-- Drop all the insecure views that bypass RLS policies
DROP VIEW IF EXISTS public.safe_profile_data CASCADE;
DROP VIEW IF EXISTS public.anonymized_profile_data CASCADE; 
DROP VIEW IF EXISTS public.safe_profiles CASCADE;
DROP VIEW IF EXISTS public.secure_profile_info CASCADE;

-- Create secure functions with explicit access controls instead of views

-- Secure function for getting anonymized profile data with proper authorization
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_safe_profile_data' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_safe_profile_data(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  display_name_safe text,
  job_category text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no target specified, only return current user's data
  IF target_user_id IS NULL THEN
    target_user_id := auth.uid();
  END IF;
  
  -- Strict authorization check
  IF target_user_id != auth.uid() AND 
     NOT has_role(auth.uid(), 'admin'::app_role) AND
     NOT (has_role(auth.uid(), 'production_manager'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view this profile';
  END IF;
  
  -- Return only the authorized user's data with proper anonymization
  RETURN QUERY
  SELECT 
    p.id,
    CASE 
      WHEN p.id = auth.uid() THEN COALESCE(p.display_name, p.full_name)
      WHEN p.email_visible_to_public = true THEN COALESCE(split_part(COALESCE(p.display_name, p.full_name), ' ', 1), 'Employee')
      ELSE 'Private User'
    END as display_name_safe,
    CASE 
      WHEN p.job_title ILIKE '%manager%' OR p.job_title ILIKE '%lead%' THEN 'Management'
      WHEN p.job_title ILIKE '%director%' OR p.job_title ILIKE '%vp%' THEN 'Leadership'
      WHEN p.job_title ILIKE '%engineer%' OR p.job_title ILIKE '%developer%' THEN 'Technical'
      ELSE 'Team Member'
    END as job_category,
    true as is_active
  FROM public.profiles p
  WHERE p.id = target_user_id;
  
  -- Audit the access
  INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details,
    created_at
  ) VALUES (
    'safe_profile_data_access',
    'low',
    jsonb_build_object(
      'viewer_id', auth.uid(),
      'target_user_id', target_user_id,
      'function', 'get_safe_profile_data'
    ),
    now()
  );
END;
$$;

-- Secure function for getting current user's profile information safely
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_current_user_profile' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  display_name text,
  email_safe text,
  job_title_safe text,
  created_at timestamp with time zone,
  privacy_consent_given boolean,
  email_visible_to_public boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Authentication required';
  END IF;
  
  -- Return only current user's profile data
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.email as email_safe,
    p.job_title as job_title_safe,
    p.created_at,
    p.privacy_consent_given,
    p.email_visible_to_public
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

-- Secure function for admins to get user profiles with proper authorization and audit
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_user_profiles_admin' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_user_profiles_admin()
RETURNS TABLE(
  id uuid,
  display_name text,
  email text,
  job_title text,
  created_at timestamp with time zone,
  privacy_consent_given boolean,
  email_visible_to_public boolean,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict admin check
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Return all profiles for admin with audit logging
  INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details,
    created_at
  ) VALUES (
    'admin_profile_bulk_access',
    'high',
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'action', 'get_user_profiles_admin',
      'timestamp', now()
    ),
    now()
  );
  
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.email,
    p.job_title,
    p.created_at,
    p.privacy_consent_given,
    p.email_visible_to_public,
    p.department
  FROM public.profiles p;
END;
$$;

-- Create a minimal, safe view for basic profile checks (no sensitive data exposed)
CREATE OR REPLACE VIEW public.user_basic_info AS
SELECT 
  p.id,
  CASE 
    WHEN p.id = auth.uid() THEN true
    ELSE false 
  END as is_current_user,
  CASE 
    WHEN p.email_visible_to_public = true THEN true
    ELSE false
  END as has_public_visibility
FROM public.profiles p
WHERE p.id = auth.uid() OR p.email_visible_to_public = true;

-- Revoke any direct access to profiles table for anonymous users
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;

-- Ensure only authenticated users have access through RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Log the comprehensive security fix
DO $aud$ BEGIN INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'employee_data_exposure_fixed',
  'critical',
  jsonb_build_object(
    'issue', 'views_exposed_employee_personal_data_publicly',
    'action', 'replaced_insecure_views_with_secure_functions',
    'security_improvements', jsonb_build_array(
      'dropped_all_insecure_profile_views',
      'created_secure_functions_with_explicit_authorization',
      'implemented_comprehensive_access_logging',
      'enforced_strict_authentication_requirements',
      'added_data_minimization_controls',
      'revoked_anonymous_access_to_profiles'
    ),
    'functions_created', jsonb_build_array(
      'get_safe_profile_data - authorized profile access with anonymization',
      'get_current_user_profile - secure current user profile access',
      'get_user_profiles_admin - admin-only bulk access with audit',
      'user_basic_info - minimal safe view for basic checks'
    ),
    'impact', 'prevented_unauthorized_access_to_employee_personal_information'
  ),
  now()
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;