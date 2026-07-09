-- Fix Employee Personal Information Security Issue
-- Separate most sensitive data into a restricted table with enhanced security

-- Create a new table for critical/highly sensitive employee data
CREATE TABLE public.employee_critical_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL, -- References employee_sensitive_data.employee_id
  social_security_partial text,
  salary_band text,
  home_address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_by uuid,
  last_accessed_at timestamp with time zone,
  access_count integer DEFAULT 0,
  
  -- Ensure one record per employee
  UNIQUE(employee_id)
);

-- Enable RLS on the critical data table
ALTER TABLE public.employee_critical_data ENABLE ROW LEVEL SECURITY;

-- Create highly restrictive RLS policies for critical data
-- Only admins can access critical data (removing HR manager access for most sensitive data)
CREATE POLICY "Only admins can view critical employee data" 
ON public.employee_critical_data 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert critical employee data" 
ON public.employee_critical_data 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update critical employee data" 
ON public.employee_critical_data 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete critical employee data" 
ON public.employee_critical_data 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create audit table for critical data access
CREATE TABLE public.employee_critical_data_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  accessed_by uuid NOT NULL,
  access_type text NOT NULL, -- 'view', 'update', 'create', 'delete'
  access_reason text,
  ip_address inet,
  user_agent text,
  accessed_at timestamp with time zone DEFAULT now(),
  risk_level text DEFAULT 'critical',
  session_id text
);

-- Enable RLS on audit table
ALTER TABLE public.employee_critical_data_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view critical data audit logs" 
ON public.employee_critical_data_audit 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can insert audit logs (for logging purposes)
CREATE POLICY "All authenticated users can insert critical data audit logs" 
ON public.employee_critical_data_audit 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Create secure function to access critical employee data with audit logging
CREATE OR REPLACE FUNCTION public.get_employee_critical_data(_employee_id text DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  employee_id text,
  social_security_partial text,
  salary_band text,
  home_address text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  audit_record record;
BEGIN
  -- Strict admin-only access check
  IF NOT has_role(current_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access critical employee data';
  END IF;
  
  -- Log the access attempt
  INSERT INTO public.employee_critical_data_audit (
    employee_id,
    accessed_by,
    access_type,
    access_reason,
    ip_address,
    accessed_at
  ) VALUES (
    COALESCE(_employee_id, 'all_records'),
    current_user_id,
    'view',
    'Critical data access via secure function',
    inet_client_addr(),
    now()
  );
  
  -- Return the requested data
  IF _employee_id IS NOT NULL THEN
    -- Update access tracking
    UPDATE public.employee_critical_data 
    SET 
      last_accessed_by = current_user_id,
      last_accessed_at = now(),
      access_count = access_count + 1
    WHERE employee_critical_data.employee_id = _employee_id;
    
    -- Return specific employee's critical data
    RETURN QUERY
    SELECT 
      ecd.id,
      ecd.employee_id,
      ecd.social_security_partial,
      ecd.salary_band,
      ecd.home_address,
      ecd.created_at,
      ecd.updated_at
    FROM public.employee_critical_data ecd
    WHERE ecd.employee_id = _employee_id;
  ELSE
    -- Return all critical data (admin overview)
    RETURN QUERY
    SELECT 
      ecd.id,
      ecd.employee_id,
      ecd.social_security_partial,
      ecd.salary_band,
      ecd.home_address,
      ecd.created_at,
      ecd.updated_at
    FROM public.employee_critical_data ecd
    ORDER BY ecd.employee_id;
  END IF;
END;
$$;

-- Create secure function to update critical employee data with audit logging
CREATE OR REPLACE FUNCTION public.update_employee_critical_data(
  _employee_id text,
  _critical_data jsonb,
  _access_reason text DEFAULT 'Data update'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb;
BEGIN
  -- Strict admin-only access check
  IF NOT has_role(current_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: Only administrators can update critical employee data'
    );
  END IF;
  
  -- Log the update attempt
  INSERT INTO public.employee_critical_data_audit (
    employee_id,
    accessed_by,
    access_type,
    access_reason,
    ip_address,
    accessed_at
  ) VALUES (
    _employee_id,
    current_user_id,
    'update',
    _access_reason,
    inet_client_addr(),
    now()
  );
  
  -- Update or insert critical data
  INSERT INTO public.employee_critical_data (
    employee_id,
    social_security_partial,
    salary_band,
    home_address,
    last_accessed_by,
    last_accessed_at,
    access_count
  ) VALUES (
    _employee_id,
    _critical_data->>'social_security_partial',
    _critical_data->>'salary_band',
    _critical_data->>'home_address',
    current_user_id,
    now(),
    1
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    social_security_partial = COALESCE(EXCLUDED.social_security_partial, employee_critical_data.social_security_partial),
    salary_band = COALESCE(EXCLUDED.salary_band, employee_critical_data.salary_band),
    home_address = COALESCE(EXCLUDED.home_address, employee_critical_data.home_address),
    updated_at = now(),
    last_accessed_by = current_user_id,
    last_accessed_at = now(),
    access_count = employee_critical_data.access_count + 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Critical employee data updated successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Migrate existing critical data from employee_sensitive_data to employee_critical_data
INSERT INTO public.employee_critical_data (
  employee_id,
  social_security_partial,
  salary_band,
  home_address
)
SELECT 
  esd.employee_id,
  esd.social_security_partial,
  esd.salary_band,
  esd.home_address
FROM public.employee_sensitive_data esd
WHERE esd.employee_id IS NOT NULL
ON CONFLICT (employee_id) DO NOTHING;

-- Remove the most sensitive columns from the original table
-- (Keep them for now with a plan to remove after verification)
-- ALTER TABLE public.employee_sensitive_data DROP COLUMN social_security_partial;
-- ALTER TABLE public.employee_sensitive_data DROP COLUMN salary_band;  
-- ALTER TABLE public.employee_sensitive_data DROP COLUMN home_address;

-- Add a comment indicating the data has been moved
COMMENT ON TABLE public.employee_critical_data IS 'Contains the most sensitive employee data with enhanced security controls. Access is restricted to administrators only and all access is audited.';

-- Create an index for performance
CREATE INDEX idx_employee_critical_data_employee_id ON public.employee_critical_data(employee_id);
CREATE INDEX idx_employee_critical_audit_employee_id ON public.employee_critical_data_audit(employee_id);
CREATE INDEX idx_employee_critical_audit_accessed_at ON public.employee_critical_data_audit(accessed_at);