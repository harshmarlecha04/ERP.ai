-- Fix User Role Information Security Issue (Corrected)
-- Drop the potentially insecure user_role_info view and implement a more secure approach

-- Drop the existing user_role_info view if it exists
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
  
  -- Return only the current user's roles with explicit access control
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.role,
    ur.granted_at
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();
  
  -- Log access for audit trail
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

-- Create a secure function for admins to access user roles
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
  
  -- Return roles based on target user or all users
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

-- Create a safe permissions view with only boolean values (no sensitive role data)
CREATE VIEW public.current_user_permissions AS
SELECT 
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') as is_admin,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'production_manager') as is_production_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'rd_manager') as is_rd_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'quality_manager') as is_quality_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hr_manager') as is_hr_manager,
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'user') as is_user
WHERE auth.uid() IS NOT NULL;

-- Revoke public access to ensure security
REVOKE ALL ON public.user_roles FROM public;
REVOKE ALL ON public.user_roles FROM anon;

-- Grant appropriate permissions to authenticated users only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Log the security fix completion
INSERT INTO public.security_alerts (
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
    ),
    'valid_roles_used', jsonb_build_array(
      'admin',
      'production_manager', 
      'rd_manager',
      'quality_manager',
      'hr_manager',
      'user'
    )
  ),
  now()
);