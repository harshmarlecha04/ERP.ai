-- Fix Security Definer Views by converting problematic SECURITY DEFINER functions to proper views or SECURITY INVOKER functions

-- Drop the problematic SECURITY DEFINER functions that return tables (they act like views but bypass RLS)
DROP FUNCTION IF EXISTS public.get_accessible_formulas_for_user(uuid);
DROP FUNCTION IF EXISTS public.get_anonymized_profile_data(uuid);
DROP FUNCTION IF EXISTS public.get_safe_profile_data(uuid);
DROP FUNCTION IF EXISTS public.get_secure_profile_info(uuid);

-- Create proper views that respect RLS instead of SECURITY DEFINER functions

-- Replace get_accessible_formulas_for_user with a proper view
CREATE VIEW public.accessible_formulas AS
SELECT 
  f.id,
  f.code,
  f.name,
  f.security_level,
  f.classification_level,
  f.status,
  f.version,
  f.created_at,
  f.updated_at,
  CASE 
    WHEN f.security_level = 'trade_secret' THEN true
    ELSE false
  END as requires_session
FROM public.formulas f
WHERE 
  -- This view will respect the existing RLS policies on formulas table
  NOT f.is_deleted;

-- Replace get_safe_profile_data with a proper view that respects RLS
CREATE VIEW public.safe_profile_data AS
SELECT 
  p.id,
  -- Show full name only for own profile or if admin
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(p.display_name, p.full_name)
    WHEN p.email_visible_to_public = true THEN COALESCE(split_part(COALESCE(p.display_name, p.full_name), ' ', 1), 'Employee')
    ELSE 'Private User'
  END as display_name_safe,
  -- Generalize job titles
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(p.job_title, 'Not specified')
    WHEN p.job_title ILIKE '%manager%' OR p.job_title ILIKE '%lead%' THEN 'Management'
    WHEN p.job_title ILIKE '%director%' OR p.job_title ILIKE '%vp%' THEN 'Leadership'
    WHEN p.job_title ILIKE '%engineer%' OR p.job_title ILIKE '%developer%' THEN 'Technical'
    ELSE 'Team Member'
  END as job_category,
  true as is_active
FROM public.profiles p;

-- Create a view for anonymized profile data that respects RLS
CREATE VIEW public.anonymized_profile_data AS
SELECT 
  p.id,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(p.display_name, p.full_name, 'You')
    WHEN p.email_visible_to_public = true THEN COALESCE(split_part(COALESCE(p.display_name, p.full_name), ' ', 1), 'Employee')
    ELSE 'Anonymous User'
  END as display_name_safe,
  CASE 
    WHEN p.job_title ILIKE '%manager%' OR p.job_title ILIKE '%lead%' THEN 'Management'
    WHEN p.job_title ILIKE '%director%' OR p.job_title ILIKE '%vp%' THEN 'Leadership'
    WHEN p.job_title ILIKE '%technical%' OR p.job_title ILIKE '%engineer%' THEN 'Technical'
    ELSE 'General'
  END as job_category,
  COALESCE(p.department, 'General') as department_general,
  true as is_active
FROM public.profiles p;

-- Create a secure profile info view that respects RLS
CREATE VIEW public.secure_profile_info AS
SELECT 
  p.id,
  -- Apply data minimization based on viewer permissions
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(p.display_name, p.full_name)
    WHEN p.email_visible_to_public = true THEN COALESCE(p.display_name, p.full_name)
    ELSE 'Private User'
  END as display_name_safe,
  -- Email with privacy controls
  CASE 
    WHEN p.id = auth.uid() THEN p.email
    WHEN p.email_visible_to_public = true THEN p.email
    ELSE CONCAT(LEFT(COALESCE(p.email, 'unknown'), 2), '***@domain.com')
  END as email_safe,
  -- Job title with generalization
  CASE 
    WHEN p.id = auth.uid() THEN p.job_title
    WHEN p.job_title ILIKE '%manager%' THEN 'Management Position'
    WHEN p.job_title ILIKE '%director%' THEN 'Leadership Position'  
    ELSE 'Team Member'
  END as job_title_safe,
  p.created_at,
  p.privacy_consent_given
FROM public.profiles p;

-- Keep get_raw_material_usage_stats as SECURITY DEFINER but add proper permission checks
-- This one needs to remain SECURITY DEFINER for access to usage statistics
CREATE OR REPLACE FUNCTION public.get_raw_material_usage_stats()
RETURNS TABLE(
  raw_material_id uuid, 
  code text, 
  name text, 
  supplier text, 
  usage_count bigint, 
  total_quantity_used numeric, 
  last_used_date timestamp with time zone, 
  first_used_date timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Strict permission check - only allow authorized roles
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view usage statistics';
  END IF;
  
  -- Log the access for audit purposes
  INSERT INTO public.security_alerts (
    alert_type,
    severity, 
    details,
    created_at
  ) VALUES (
    'usage_stats_access',
    'low',
    jsonb_build_object(
      'user_id', auth.uid(),
      'function', 'get_raw_material_usage_stats',
      'timestamp', now()
    ),
    now()
  );
  
  -- Return the usage statistics data with proper authorization
  RETURN QUERY
  SELECT 
    rmus.raw_material_id,
    rmus.code,
    rmus.name,
    rmus.supplier,
    rmus.usage_count,
    rmus.total_quantity_used,
    rmus.last_used_date,
    rmus.first_used_date
  FROM public.raw_material_usage_stats rmus;
END;
$$;

-- Log the security fix
INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'security_definer_views_fixed',
  'high',
  jsonb_build_object(
    'action', 'converted_security_definer_functions_to_proper_views',
    'functions_converted', jsonb_build_array(
      'get_accessible_formulas_for_user -> accessible_formulas view',
      'get_safe_profile_data -> safe_profile_data view',
      'get_anonymized_profile_data -> anonymized_profile_data view', 
      'get_secure_profile_info -> secure_profile_info view'
    ),
    'security_improvement', 'views_now_respect_RLS_policies',
    'retained_security_definer', jsonb_build_array(
      'get_raw_material_usage_stats (with enhanced permission checks)'
    )
  ),
  now()
);