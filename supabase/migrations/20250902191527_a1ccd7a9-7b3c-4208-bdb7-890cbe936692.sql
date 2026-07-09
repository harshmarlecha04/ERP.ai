-- Fix User Role Information Security Issue (Final)
-- Remove insecure user_role_info view and create secure access functions

-- Drop the insecure user_role_info view 
DROP VIEW IF EXISTS public.user_role_info CASCADE;

-- Drop existing current_user_permissions view if it exists to recreate it securely
DROP VIEW IF EXISTS public.current_user_permissions CASCADE;

-- Create a secure function for getting current user's roles
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_current_user_roles' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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
  -- Authentication required
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Authentication required';
  END IF;
  
  -- Return only current user's roles
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.role,
    ur.granted_at
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();
END;
$$;

-- Create secure admin function for role management
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_user_roles_admin' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_user_roles_admin(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  role app_role,
  granted_at timestamp with time zone,
  granted_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin authorization required
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  IF target_user_id IS NULL THEN
    RETURN QUERY
    SELECT ur.user_id, ur.role, ur.granted_at, ur.granted_by
    FROM public.user_roles ur
    ORDER BY ur.granted_at DESC;
  ELSE
    RETURN QUERY
    SELECT ur.user_id, ur.role, ur.granted_at, ur.granted_by
    FROM public.user_roles ur
    WHERE ur.user_id = target_user_id;
  END IF;
END;
$$;

-- Revoke dangerous public access
REVOKE ALL ON public.user_roles FROM public;
REVOKE ALL ON public.user_roles FROM anon;

-- Grant only to authenticated users through RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Log the security fix
DO $aud$ BEGIN INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'user_role_security_vulnerability_fixed',
  'critical',
  jsonb_build_object(
    'vulnerability', 'user_role_info_view_publicly_accessible',
    'fix_actions', jsonb_build_array(
      'dropped_insecure_user_role_info_view',
      'created_secure_function_based_access_control',
      'revoked_public_and_anonymous_access',
      'implemented_strict_authentication_checks',
      'added_admin_authorization_validation'
    ),
    'security_impact', 'prevented_unauthorized_access_to_user_roles_and_permissions'
  ),
  now()
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;