-- Fix Employee Personal Data Exposure - Targeted Security Fix
-- Remove the insecure views that expose employee data publicly

-- Drop all the insecure views that bypass RLS policies and expose personal data
DROP VIEW IF EXISTS public.safe_profile_data CASCADE;
DROP VIEW IF EXISTS public.anonymized_profile_data CASCADE; 
DROP VIEW IF EXISTS public.safe_profiles CASCADE;
DROP VIEW IF EXISTS public.secure_profile_info CASCADE;

-- Create a single, secure function for authorized profile access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_authorized_profile_data' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_authorized_profile_data(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  display_name_safe text,
  job_category text,
  email_safe text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Default to current user if no target specified
  IF target_user_id IS NULL THEN
    target_user_id := auth.uid();
  END IF;
  
  -- Strict authorization: only self, admins, or managers with consent
  IF target_user_id != auth.uid() AND 
     NOT has_role(auth.uid(), 'admin'::app_role) THEN
    
    -- Check if viewer is a manager and target has given consent
    IF NOT (
      (has_role(auth.uid(), 'production_manager'::app_role) OR 
       has_role(auth.uid(), 'rd_manager'::app_role)) AND
      EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id AND email_visible_to_public = true)
    ) THEN
      RAISE EXCEPTION 'Access denied: Insufficient permissions to view this profile data';
    END IF;
  END IF;
  
  -- Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Authentication required';
  END IF;
  
  -- Return authorized data with appropriate anonymization
  RETURN QUERY
  SELECT 
    p.id,
    CASE 
      WHEN p.id = auth.uid() THEN COALESCE(p.display_name, p.full_name, 'You')
      WHEN p.email_visible_to_public = true THEN COALESCE(split_part(COALESCE(p.display_name, p.full_name), ' ', 1), 'Employee')
      ELSE 'Private User'
    END as display_name_safe,
    CASE 
      WHEN p.job_title ILIKE '%manager%' OR p.job_title ILIKE '%lead%' THEN 'Management'
      WHEN p.job_title ILIKE '%director%' OR p.job_title ILIKE '%vp%' THEN 'Leadership' 
      WHEN p.job_title ILIKE '%engineer%' OR p.job_title ILIKE '%developer%' THEN 'Technical'
      ELSE 'General'
    END as job_category,
    CASE 
      WHEN p.id = auth.uid() THEN p.email
      WHEN p.email_visible_to_public = true THEN p.email
      ELSE CONCAT(LEFT(COALESCE(p.email, 'unknown'), 2), '***@company.com')
    END as email_safe,
    p.created_at
  FROM public.profiles p
  WHERE p.id = target_user_id;
  
  -- Comprehensive audit logging
  INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details,
    created_at
  ) VALUES (
    'authorized_profile_access',
    CASE 
      WHEN target_user_id = auth.uid() THEN 'low'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'viewer_id', auth.uid(),
      'target_user_id', target_user_id,
      'access_type', CASE WHEN target_user_id = auth.uid() THEN 'self' ELSE 'other' END,
      'function', 'get_authorized_profile_data',
      'timestamp', now()
    ),
    now()
  );
END;
$$;

-- Completely revoke public access to ensure no unauthorized data exposure
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;

-- Ensure authenticated access is properly controlled through RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Log the critical security fix
DO $aud$ BEGIN INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'employee_personal_data_exposure_fixed',
  'critical',
  jsonb_build_object(
    'issue', 'multiple_views_exposed_employee_personal_data_publicly',
    'vulnerabilities_closed', jsonb_build_array(
      'safe_profile_data - exposed names and job titles',
      'anonymized_profile_data - exposed department information',
      'safe_profiles - exposed email addresses',
      'secure_profile_info - exposed personal information'
    ),
    'security_improvements', jsonb_build_array(
      'dropped_all_insecure_profile_views',
      'created_single_secure_function_with_strict_authorization',
      'revoked_all_public_anonymous_access_to_profiles',
      'implemented_comprehensive_access_audit_logging',
      'enforced_consent_based_data_sharing',
      'added_data_anonymization_for_unauthorized_viewers'
    ),
    'impact', 'eliminated_public_exposure_of_employee_names_emails_job_titles_departments',
    'compliance', 'enhanced_gdpr_ccpa_privacy_protection'
  ),
  now()
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;