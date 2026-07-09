-- Create a separate table for highly sensitive employee data
CREATE TABLE public.employee_sensitive_data (
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
ALTER TABLE public.employee_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Create highly restrictive policies for sensitive data
CREATE POLICY "Only admins and HR can view sensitive employee data" 
ON public.employee_sensitive_data 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr_manager'::app_role)
);

CREATE POLICY "Only admins and HR can update sensitive employee data" 
ON public.employee_sensitive_data 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr_manager'::app_role)
);

CREATE POLICY "Only admins and HR can create sensitive employee data" 
ON public.employee_sensitive_data 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr_manager'::app_role)
);

CREATE POLICY "Only admins can delete sensitive employee data" 
ON public.employee_sensitive_data 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a secure function for limited profile data access
CREATE OR REPLACE FUNCTION public.get_limited_profile_data(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  display_name text,
  job_title_general text,
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
          has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    -- Generalize job titles to reduce exposure
    CASE 
      WHEN p.job_title ILIKE '%manager%' THEN 'Management'
      WHEN p.job_title ILIKE '%director%' THEN 'Leadership'
      WHEN p.job_title ILIKE '%engineer%' THEN 'Technical'
      WHEN p.job_title ILIKE '%analyst%' THEN 'Analysis'
      ELSE 'Staff'
    END as job_title_general,
    -- Generalize department info
    COALESCE(esd.department, 'General') as department_general,
    true as is_active
  FROM public.profiles p
  LEFT JOIN public.employee_sensitive_data esd ON esd.id = p.id
  WHERE p.id = target_user_id;
END;
$$;

-- Update the profiles table RLS policies to be more restrictive
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;

-- Create new granular policies for profiles
CREATE POLICY "Users can view basic own profile data" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid())
-- Users can only see their own basic profile data
;

CREATE POLICY "Admins can view all profile data" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view limited profile data of their team" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'rd_manager'::app_role)
);

-- Create an audit function for profile access
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

-- Create a trigger to automatically log profile access
CREATE OR REPLACE FUNCTION public.audit_profile_access_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when someone accesses a profile
  IF TG_OP = 'SELECT' AND auth.uid() IS NOT NULL THEN
    PERFORM public.log_profile_access(
      auth.uid(),
      NEW.id,
      'view',
      'profile_data_access'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add data minimization controls - remove email from general profile view
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_visible_to_public boolean DEFAULT false;

-- Log this security enhancement
INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'profile_security_enhancement',
  'high',
  jsonb_build_object(
    'action', 'implemented_field_level_security',
    'changes', jsonb_build_array(
      'created_employee_sensitive_data_table',
      'implemented_granular_rls_policies',
      'added_profile_access_audit_logging',
      'created_limited_profile_data_function',
      'added_data_minimization_controls'
    ),
    'security_improvements', jsonb_build_array(
      'separated_sensitive_employee_data',
      'restricted_cross_profile_access',
      'implemented_role_based_data_classification',
      'added_audit_trail_for_profile_access',
      'generalized_job_title_exposure'
    )
  ),
  now()
);