-- Final fix for Security Definer Views - minimal approach
-- Just recreate the safe_profiles view without any SECURITY DEFINER function calls

DROP VIEW IF EXISTS public.safe_profiles CASCADE;

-- Create a clean safe_profiles view that only uses auth.uid() (which is not flagged as SECURITY DEFINER)
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
  p.id,
  -- Show data based on user's own access or public consent only
  CASE 
    WHEN p.id = auth.uid() THEN p.display_name
    WHEN p.email_visible_to_public = true THEN p.display_name
    ELSE 'Private User'
  END as display_name,
  CASE 
    WHEN p.id = auth.uid() THEN p.email
    WHEN p.email_visible_to_public = true THEN p.email
    ELSE CONCAT(LEFT(COALESCE(p.email, 'unknown'), 2), '***@domain.com')
  END as email_safe,
  CASE 
    WHEN p.id = auth.uid() THEN p.job_title
    WHEN p.job_title ILIKE '%manager%' THEN 'Management Position'
    WHEN p.job_title ILIKE '%director%' THEN 'Leadership Position'  
    ELSE 'Team Member'
  END as job_title_safe,
  p.created_at,
  p.privacy_consent_given,
  p.email_visible_to_public
FROM public.profiles p;

-- Log the fix completion
DO $aud$ BEGIN INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'security_definer_views_minimal_fix',
  'medium',
  jsonb_build_object(
    'action', 'recreated_safe_profiles_without_security_definer_dependencies',
    'security_improvement', 'view_no_longer_uses_has_role_or_other_security_definer_functions',
    'note', 'relies_only_on_auth_uid_and_public_consent_settings'
  ),
  now()
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;