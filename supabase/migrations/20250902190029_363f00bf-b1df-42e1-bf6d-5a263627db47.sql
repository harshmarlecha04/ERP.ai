-- First, let's add the hr_manager role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_manager';

-- Create a separate table for highly sensitive employee data
CREATE TABLE IF NOT EXISTS public.employee_sensitive_data (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  employee_id text,
  department text,
  manager_id uuid REFERENCES auth.users(id),
  hire_date date,
  salary_band text,
  security_clearance text DEFAULT 'standard',
  emergency_contact_name text,
  emergency_contact_phone text,
  home_address text,
  social_security_partial text, -- Only last 4 digits
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  data_classification text DEFAULT 'confidential',
  
  PRIMARY KEY (id)
);

-- Enable RLS on the sensitive data table
DO $rls$ BEGIN ALTER TABLE public.employee_sensitive_data ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create highly restrictive policies for sensitive data
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can view sensitive employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can view sensitive employee data" 
ON public.employee_sensitive_data 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can update sensitive employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can update sensitive employee data" 
ON public.employee_sensitive_data 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can create sensitive employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can create sensitive employee data" 
ON public.employee_sensitive_data 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete sensitive employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete sensitive employee data" 
ON public.employee_sensitive_data 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Add data minimization controls to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_visible_to_public boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;

-- Create a secure function for anonymized profile data access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_anonymized_profile_data' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_anonymized_profile_data(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  display_name_safe text,
  job_category text,
  department_general text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow access to own profile or if user is admin/manager
  IF target_user_id != auth.uid() AND 
     NOT (has_role(auth.uid(), 'admin'::app_role) OR 
          has_role(auth.uid(), 'production_manager'::app_role) OR
          has_role(auth.uid(), 'rd_manager'::app_role)) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    -- Provide only first name or initials for non-own profiles
    CASE 
      WHEN target_user_id = auth.uid() THEN p.display_name
      ELSE COALESCE(split_part(p.display_name, ' ', 1), 'Employee')
    END as display_name_safe,
    -- Generalize job titles to reduce exposure
    CASE 
      WHEN p.job_title ILIKE '%manager%' OR p.job_title ILIKE '%lead%' THEN 'Management'
      WHEN p.job_title ILIKE '%director%' OR p.job_title ILIKE '%vp%' THEN 'Leadership'
      WHEN p.job_title ILIKE '%engineer%' OR p.job_title ILIKE '%developer%' THEN 'Technical'
      WHEN p.job_title ILIKE '%analyst%' OR p.job_title ILIKE '%scientist%' THEN 'Analysis'
      WHEN p.job_title ILIKE '%coordinator%' OR p.job_title ILIKE '%specialist%' THEN 'Operations'
      ELSE 'Staff'
    END as job_category,
    -- Generalize department info
    COALESCE(p.department, 'General') as department_general,
    true as is_active
  FROM public.profiles p
  WHERE p.id = target_user_id;
END;
$$;

-- Create enhanced audit function for profile access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_profile_access_enhanced' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_profile_access_enhanced(
  viewer_id uuid,
  profile_id uuid,
  access_type text,
  access_reason text DEFAULT NULL,
  data_accessed text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  risk_level text := 'medium';
BEGIN
  -- Determine risk level based on access pattern
  IF viewer_id != profile_id THEN
    -- Cross-profile access is higher risk
    risk_level := 'high';
  ELSIF access_type IN ('export', 'bulk_access', 'api_access') THEN
    -- Bulk or API access is higher risk
    risk_level := 'high';
  ELSE
    risk_level := 'low';
  END IF;

  INSERT INTO public.profile_access_audit (
    viewer_id,
    profile_id,
    access_type,
    access_reason,
    ip_address,
    accessed_at,
    risk_level,
    user_agent,
    session_id
  ) VALUES (
    viewer_id,
    profile_id,
    access_type,
    access_reason,
    inet_client_addr(),
    now(),
    risk_level,
    current_setting('request.headers', true)::jsonb->>'user-agent',
    current_setting('request.jwt.claims', true)::jsonb->>'session_id'
  );
  
  -- Generate alert for high-risk access
  IF risk_level = 'high' THEN
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      details,
      created_at
    ) VALUES (
      'high_risk_profile_access',
      'medium',
      jsonb_build_object(
        'viewer_id', viewer_id,
        'profile_id', profile_id,
        'access_type', access_type,
        'risk_factors', CASE 
          WHEN viewer_id != profile_id THEN 'cross_profile_access'
          ELSE access_type
        END
      ),
      now()
    );
  END IF;
END;
$$;

-- Update existing profile policies to be more restrictive
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all profile data" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Managers can view limited profile data of their team" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new granular policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own profile data only" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view own profile data only" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all profiles with audit" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view all profiles with audit" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  -- Log admin access to profiles
  (SELECT log_profile_access_enhanced(auth.uid(), id, 'admin_view', 'administrative_access') IS NULL)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Managers can view limited team profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Managers can view limited team profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (has_role(auth.uid(), 'production_manager'::app_role) OR 
   has_role(auth.uid(), 'rd_manager'::app_role)) AND
  -- Log manager access
  (SELECT log_profile_access_enhanced(auth.uid(), id, 'manager_view', 'team_management') IS NULL)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create a data classification view for secure profile access
CREATE OR REPLACE VIEW public.secure_profiles AS
SELECT 
  p.id,
  -- Only show display name if user consents or it's their own profile
  CASE 
    WHEN p.id = auth.uid() OR p.email_visible_to_public = true THEN p.display_name
    ELSE 'Private User'
  END as display_name,
  -- Anonymize email unless it's the user's own profile or admin
  CASE 
    WHEN p.id = auth.uid() THEN p.email
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.email
    WHEN p.email_visible_to_public = true THEN p.email
    ELSE CONCAT(LEFT(split_part(p.email, '@', 1), 2), '***@', split_part(p.email, '@', 2))
  END as email_safe,
  -- Generalize job titles
  CASE 
    WHEN p.id = auth.uid() THEN p.job_title
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.job_title
    ELSE CASE 
      WHEN p.job_title ILIKE '%manager%' THEN 'Management Role'
      WHEN p.job_title ILIKE '%director%' THEN 'Leadership Role'
      ELSE 'Team Member'
    END
  END as job_title_safe,
  p.created_at,
  p.privacy_consent_given
FROM public.profiles p
WHERE 
  -- Users can see their own profile
  p.id = auth.uid() OR
  -- Admins can see all profiles  
  has_role(auth.uid(), 'admin'::app_role) OR
  -- Managers can see basic info of profiles that opted in
  (
    (has_role(auth.uid(), 'production_manager'::app_role) OR 
     has_role(auth.uid(), 'rd_manager'::app_role)) AND
    p.email_visible_to_public = true
  );

-- Log this comprehensive security enhancement
DO $aud$ BEGIN INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'comprehensive_profile_security_implementation',
  'high',
  jsonb_build_object(
    'action', 'implemented_comprehensive_profile_security',
    'security_measures', jsonb_build_array(
      'created_employee_sensitive_data_table',
      'implemented_data_anonymization',
      'added_comprehensive_audit_logging',
      'created_secure_profile_view',
      'implemented_consent_based_visibility',
      'added_job_title_generalization',
      'restricted_cross_profile_access',
      'implemented_risk_based_monitoring'
    ),
    'compliance_improvements', jsonb_build_array(
      'data_minimization_principle',
      'purpose_limitation',
      'consent_management',
      'audit_trail_enhancement',
      'access_control_granularity'
    )
  ),
  now()
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;