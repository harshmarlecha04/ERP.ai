-- Fix User Role Information Security Issue (Simple Fix)
-- Remove the insecure user_role_info view and tighten security

-- Drop the existing user_role_info view that exposes role information
DROP VIEW IF EXISTS public.user_role_info CASCADE;

-- Create a secure function for getting current user's roles
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS TABLE(
  user_id uuid,
  role app_role,
  granted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Not authenticated';
  END IF;
  
  -- Return only the current user's roles with explicit authorization
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.role,
    ur.granted_at
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();
END;
$$;

-- Revoke any public access to prevent unauthorized role information access
REVOKE ALL ON public.user_roles FROM public;
REVOKE ALL ON public.user_roles FROM anon;

-- Ensure only authenticated users can access through RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Log the security fix
INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'user_role_info_security_fixed',
  'critical',
  jsonb_build_object(
    'issue', 'user_role_info_view_exposed_roles_publicly',
    'action', 'dropped_insecure_view_and_tightened_access_control',
    'security_improvements', jsonb_build_array(
      'removed_public_access_to_user_role_information',
      'created_authenticated_only_role_access_function',
      'revoked_public_and_anonymous_permissions',
      'enforced_strict_authentication_checks'
    ),
    'impact', 'prevented_unauthorized_access_to_user_roles_and_permissions'
  ),
  now()
);