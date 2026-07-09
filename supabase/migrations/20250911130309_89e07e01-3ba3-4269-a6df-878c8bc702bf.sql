-- Fix critical security vulnerability: Replace dangerous blanket denial with proper role-based access
-- Current "USING condition: false" creates security risks if bypassed or misconfigured

-- Drop the dangerous blanket denial policy
DROP POLICY IF EXISTS "Only secure function access to sensitive data" ON public.employee_sensitive_data;

-- Create secure role-based access policies

-- 1. Admins have full access to all employee sensitive data
CREATE POLICY "Admins can access all employee sensitive data" 
ON public.employee_sensitive_data 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. HR Managers can access data only with active approved session
CREATE POLICY "HR managers require approved active session" 
ON public.employee_sensitive_data 
FOR SELECT 
USING (
  has_role(auth.uid(), 'hr_manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.hr_sensitive_data_sessions s
    JOIN public.hr_data_access_requests r ON r.id = s.request_id
    WHERE s.user_id = auth.uid()
    AND s.is_active = true
    AND s.expires_at > now()
    AND r.status = 'approved'
    AND r.employee_id = employee_sensitive_data.employee_id
  )
);

-- 3. Employees can view only their own record
CREATE POLICY "Employees can view own data only" 
ON public.employee_sensitive_data 
FOR SELECT 
USING (auth.uid() = id);

-- Update table comment to document the new security model
COMMENT ON TABLE public.employee_sensitive_data IS 'Employee sensitive data with role-based access controls. Admins have full access, HR managers need approved sessions, employees see only their own data. All access should be audited by applications.';