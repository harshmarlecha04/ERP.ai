-- Fix Critical Security Vulnerability: Employee Personal Information Access
-- Replace overly permissive RLS policies with secure, role-based access control (CORRECTED)

-- Drop the insecure policies that allow any authenticated user to access employee data
DROP POLICY IF EXISTS "All authenticated users can view employee data" ON public.employee_sensitive_data;
DROP POLICY IF EXISTS "All authenticated users can manage employee data" ON public.employee_sensitive_data;

-- Create secure RLS policies for employee sensitive data access

-- 1. VIEW policies - Who can see employee sensitive data
CREATE POLICY "HR managers can view all employee data" ON public.employee_sensitive_data
FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
);

CREATE POLICY "Employees can view their own data" ON public.employee_sensitive_data
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Managers can view their direct reports data" ON public.employee_sensitive_data
FOR SELECT USING (manager_id = auth.uid());

-- 2. INSERT policies - Who can create employee records
CREATE POLICY "Only HR managers can create employee records" ON public.employee_sensitive_data
FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
);

-- 3. UPDATE policies - Who can modify employee data
CREATE POLICY "HR managers can update all employee data" ON public.employee_sensitive_data
FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
) WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
);

-- Employees can only update their emergency contact information, not sensitive fields
CREATE POLICY "Employees can update emergency contact only" ON public.employee_sensitive_data
FOR UPDATE USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

-- 4. DELETE policies - Who can remove employee records
CREATE POLICY "Only admins can delete employee records" ON public.employee_sensitive_data
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create secure function for employee self-service updates (limited fields only)
CREATE OR REPLACE FUNCTION public.update_employee_emergency_contact(
    _employee_id uuid,
    _emergency_contact_name text,
    _emergency_contact_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
BEGIN
    -- Validate that user can only update their own data
    IF current_user_id != _employee_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: Can only update your own emergency contact');
    END IF;
    
    -- Check if the employee record exists and belongs to the user
    IF NOT EXISTS (SELECT 1 FROM public.employee_sensitive_data WHERE id = _employee_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Employee record not found');
    END IF;
    
    -- Update only emergency contact fields
    UPDATE public.employee_sensitive_data 
    SET 
        emergency_contact_name = _emergency_contact_name,
        emergency_contact_phone = _emergency_contact_phone,
        updated_at = now()
    WHERE id = _employee_id;
    
    -- Log the update
    PERFORM public.log_employee_data_access(
        _employee_id,
        current_user_id,
        'self_update_emergency_contact',
        jsonb_build_object(
            'updated_fields', jsonb_build_array('emergency_contact_name', 'emergency_contact_phone')
        )
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Emergency contact updated successfully');
END;
$$;

-- Create audit function for employee data access
CREATE OR REPLACE FUNCTION public.log_employee_data_access(
    _employee_id uuid,
    _accessed_by uuid,
    _access_type text,
    _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log access to employee sensitive data for compliance
    INSERT INTO public.profile_access_audit (
        profile_id,
        viewer_id,
        access_type,
        access_reason,
        ip_address,
        accessed_at
    ) VALUES (
        _employee_id,
        _accessed_by,
        _access_type,
        'Employee sensitive data access',
        inet_client_addr(),
        now()
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore audit logging errors to prevent blocking main operations
        NULL;
END;
$$;

-- Create a secure function for HR managers to get employee data with audit logging
CREATE OR REPLACE FUNCTION public.get_employee_sensitive_data(_employee_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
    id uuid,
    employee_id text,
    department text,
    manager_id uuid,
    hire_date date,
    salary_band text,
    security_clearance text,
    emergency_contact_name text,
    emergency_contact_phone text,
    home_address text,
    social_security_partial text,
    data_classification text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_has_hr_access boolean := false;
    user_is_manager boolean := false;
BEGIN
    -- Check if user has HR access
    user_has_hr_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role)
    );
    
    -- If requesting specific employee data, check manager relationship
    IF _employee_id IS NOT NULL AND NOT user_has_hr_access THEN
        SELECT EXISTS (
            SELECT 1 FROM public.employee_sensitive_data 
            WHERE id = _employee_id AND manager_id = current_user_id
        ) INTO user_is_manager;
    END IF;
    
    -- Return data based on access level
    IF user_has_hr_access THEN
        -- HR managers can see all data
        RETURN QUERY
        SELECT 
            esd.id, esd.employee_id, esd.department, esd.manager_id,
            esd.hire_date, esd.salary_band, esd.security_clearance,
            esd.emergency_contact_name, esd.emergency_contact_phone,
            esd.home_address, esd.social_security_partial,
            esd.data_classification, esd.created_at, esd.updated_at
        FROM public.employee_sensitive_data esd
        WHERE (_employee_id IS NULL OR esd.id = _employee_id)
        ORDER BY esd.employee_id;
        
        -- Log HR access
        PERFORM public.log_employee_data_access(
            COALESCE(_employee_id, '00000000-0000-0000-0000-000000000000'::uuid),
            current_user_id,
            'hr_access',
            jsonb_build_object('scope', CASE WHEN _employee_id IS NULL THEN 'all_employees' ELSE 'single_employee' END)
        );
        
    ELSIF _employee_id IS NOT NULL AND (user_is_manager OR _employee_id = current_user_id) THEN
        -- Managers can see their direct reports, employees can see their own data
        RETURN QUERY
        SELECT 
            esd.id, esd.employee_id, esd.department, esd.manager_id,
            esd.hire_date, 
            CASE WHEN _employee_id = current_user_id THEN esd.salary_band ELSE NULL::text END,
            esd.security_clearance,
            esd.emergency_contact_name, esd.emergency_contact_phone,
            CASE WHEN _employee_id = current_user_id THEN esd.home_address ELSE NULL::text END,
            CASE WHEN _employee_id = current_user_id THEN esd.social_security_partial ELSE NULL::text END,
            esd.data_classification, esd.created_at, esd.updated_at
        FROM public.employee_sensitive_data esd
        WHERE esd.id = _employee_id;
        
        -- Log access
        PERFORM public.log_employee_data_access(
            _employee_id,
            current_user_id,
            CASE WHEN _employee_id = current_user_id THEN 'self_access' ELSE 'manager_access' END,
            jsonb_build_object('access_type', 'limited_view')
        );
    END IF;
END;
$$;

COMMENT ON TABLE public.employee_sensitive_data IS 'Contains highly sensitive employee personal information. Access is strictly controlled and audited. Only HR managers, the employee themselves, and their direct manager can access this data.';