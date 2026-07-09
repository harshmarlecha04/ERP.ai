-- Fix Security Definer View Issues
-- Drop views that use SECURITY DEFINER functions and replace with secure alternatives

-- Drop the problematic views that call SECURITY DEFINER functions
DROP VIEW IF EXISTS public.accessible_formulas CASCADE;
DROP VIEW IF EXISTS public.user_basic_info CASCADE;

-- Create secure function to replace accessible_formulas view
CREATE OR REPLACE FUNCTION public.get_accessible_formulas()
RETURNS TABLE(
  id uuid,
  code text,
  name text,
  security_level text,
  classification_level text,
  status text,
  version text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  requires_session boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated to access formulas
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Authentication required';
  END IF;
  
  -- Return formulas based on user permissions (this replaces the view logic)
  RETURN QUERY
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
  WHERE NOT f.is_deleted
  AND (
    -- Admin can see all
    has_role(auth.uid(), 'admin'::app_role) OR
    -- User has explicit permission for this formula
    EXISTS (
      SELECT 1 FROM public.formula_user_permissions fup
      WHERE fup.formula_id = f.id 
      AND fup.user_id = auth.uid()
      AND fup.is_active = true
      AND (fup.expires_at IS NULL OR fup.expires_at > now())
    )
  );
  
  -- Log access for security audit
  INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details,
    created_at
  ) VALUES (
    'accessible_formulas_function_access',
    'low',
    jsonb_build_object(
      'user_id', auth.uid(),
      'function', 'get_accessible_formulas',
      'timestamp', now()
    ),
    now()
  );
END;
$$;

-- Create secure function to replace user_basic_info view
CREATE OR REPLACE FUNCTION public.get_user_basic_info(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  is_current_user boolean,
  has_public_visibility boolean
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
  
  -- Default to current user if no target specified
  IF target_user_id IS NULL THEN
    target_user_id := auth.uid();
  END IF;
  
  -- Only allow access to own profile or if target has public visibility
  IF target_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = target_user_id 
      AND p.email_visible_to_public = true
    ) THEN
      RAISE EXCEPTION 'Access denied: Profile is not publicly visible';
    END IF;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    (p.id = auth.uid()) as is_current_user,
    COALESCE(p.email_visible_to_public, false) as has_public_visibility
  FROM public.profiles p
  WHERE p.id = target_user_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_accessible_formulas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_basic_info(uuid) TO authenticated;

-- Log the security fix
INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'security_definer_view_fixed',
  'high',
  jsonb_build_object(
    'issue', 'security_definer_views_dropped_and_replaced',
    'views_removed', jsonb_build_array(
      'accessible_formulas - exposed formulas through security definer functions',
      'user_basic_info - exposed profile info through auth.uid() security definer'
    ),
    'security_improvements', jsonb_build_array(
      'dropped_security_definer_views',
      'created_secure_functions_with_explicit_authorization',
      'added_authentication_checks',
      'implemented_access_logging',
      'enforced_proper_permission_checking'
    ),
    'impact', 'eliminated_potential_privilege_escalation_through_security_definer_views',
    'compliance', 'enhanced_security_posture'
  ),
  now()
);