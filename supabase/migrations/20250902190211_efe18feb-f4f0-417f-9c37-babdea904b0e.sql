-- Fix function search path issues by ensuring all functions have SET search_path
-- Update all functions that don't have search_path set

-- Fix log_profile_access function
CREATE OR REPLACE FUNCTION public.log_profile_access(
  viewer_id uuid,
  profile_id uuid,
  access_type text,
  access_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_access_audit (
    viewer_id,
    profile_id,
    access_type,
    access_reason,
    ip_address,
    accessed_at,
    risk_level
  ) VALUES (
    viewer_id,
    profile_id,
    access_type,
    access_reason,
    inet_client_addr(),
    now(),
    CASE 
      WHEN viewer_id != profile_id THEN 'high'
      ELSE 'low'
    END
  );
END;
$$;

-- Ensure the profile access trigger function has proper search path
CREATE OR REPLACE FUNCTION public.profile_access_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log when it's a cross-profile access by non-admins
  IF NEW.id != auth.uid() AND 
     NOT has_role(auth.uid(), 'admin'::app_role) THEN
    PERFORM log_profile_access_enhanced(
      auth.uid(),
      NEW.id,
      'cross_profile_view',
      'manager_team_access'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update any other functions that might be missing search_path
-- (These are from previous migrations that might need updating)

CREATE OR REPLACE FUNCTION public.log_formula_access(_user_id uuid, _formula_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log to audit table
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id,
        access_type,
        details,
        accessed_at
    ) VALUES (
        _user_id,
        _formula_id,
        _access_type,
        _details,
        now()
    );
END;
$$;

-- Log the security path fixes
INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'function_search_path_security_fix',
  'medium',
  jsonb_build_object(
    'action', 'fixed_function_search_path_vulnerabilities',
    'functions_updated', jsonb_build_array(
      'log_profile_access',
      'profile_access_trigger', 
      'log_formula_access'
    ),
    'security_improvement', 'prevents_search_path_manipulation_attacks'
  ),
  now()
);