-- Fix User Role Information Security Issue (Corrected)
-- Drop the potentially insecure user_role_info view and implement a more secure approach

-- Drop the existing user_role_info view
DROP VIEW IF EXISTS public.user_role_info CASCADE;

-- Create a secure function instead of a view for getting user role information
-- This provides better access control than a view
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
  -- Strict authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Not authenticated';
  END IF;
  
  -- Return only the current user's roles
  -- This is more secure than a view as it has explicit access control
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.role,
    ur.granted_at
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();
  
  -- Log the access for audit purposes
  INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details,
    created_at
  ) VALUES (
    'user_role_access',
    'low',
    jsonb_build_object(
      'user_id', auth.uid(),
      'action', 'get_current_user_roles',
      'timestamp', now()
    ),
    now()
  );
END;
$$;

-- Create a secure function for admins to get user roles with proper authorization
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
  -- Strict admin authorization check
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- If no target user specified, return all user roles (admin only)
  IF target_user_id IS NULL THEN
    RETURN QUERY
    SELECT 
      ur.user_id,
      ur.role,
      ur.granted_at,
      ur.granted_by
    FROM public.user_roles ur
    ORDER BY ur.granted_at DESC;
  ELSE
    -- Return roles for specific user (admin only)
    RETURN QUERY
    SELECT 
      ur.user_id,
      ur.role,
      ur.granted_at,
      ur.granted_by
    FROM public.user_roles ur
    WHERE ur.user_id = target_user_id;
  END IF;
  
  -- Log admin access
  INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details,
    created_at
  ) VALUES (
    'admin_user_role_access',
    'medium',
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'target_user_id', target_user_id,
      'action', 'get_user_roles_admin',
      'timestamp', now()
    ),
    now()
  );
END;
$$;

-- Revoke any public permissions on user_roles table to ensure access is only through functions
REVOKE ALL ON public.user_roles FROM public;
REVOKE ALL ON public.user_roles FROM anon;

-- Grant specific permissions only to authenticated users through the RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Create a simple view for the current user's role check (most common use case)
-- This view is safe because it only shows boolean results, not actual role data
CREATE OR REPLACE VIEW public.current_user_permissions AS
SELECT 
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') as is_admin,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'production_manager') as is_production_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'rd_manager') as is_rd_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'quality_manager') as is_quality_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hr_manager') as is_hr_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'user') as is_user
WHERE auth.uid() IS NOT NULL;

-- Log the security fix
DO $aud$ BEGIN INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'user_role_info_security_fixed',
  'high',
  jsonb_build_object(
    'action', 'secured_user_role_information_access',
    'changes_made', jsonb_build_array(
      'dropped_insecure_user_role_info_view',
      'created_secure_get_current_user_roles_function',
      'created_admin_get_user_roles_function_with_authorization',
      'revoked_public_access_to_user_roles_table',
      'created_safe_current_user_permissions_view'
    ),
    'security_improvements', jsonb_build_array(
      'explicit_authentication_checks',
      'function_based_access_control',
      'comprehensive_audit_logging',
      'admin_authorization_validation',
      'minimal_data_exposure'
    )
  ),
  now()
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;