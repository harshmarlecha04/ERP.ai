-- Implement Stricter Employee Data Security: HR Personnel Only Access
-- Remove manager and employee access to highly sensitive data

-- Drop policies that allow non-HR access to sensitive employee data
DROP POLICY IF EXISTS "Employees can view their own data" ON public.employee_sensitive_data;
DROP POLICY IF EXISTS "Managers can view their direct reports data" ON public.employee_sensitive_data;
DROP POLICY IF EXISTS "Employees can update emergency contact only" ON public.employee_sensitive_data;

-- Update the secure function to reflect HR-only access policy
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
BEGIN
    -- Check if user has HR access (only HR managers and admins)
    user_has_hr_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role)
    );
    
    -- Only HR personnel can access this data
    IF NOT user_has_hr_access THEN
        -- Log unauthorized access attempt
        PERFORM public.log_employee_data_access(
            COALESCE(_employee_id, '00000000-0000-0000-0000-000000000000'::uuid),
            current_user_id,
            'access_denied',
            jsonb_build_object(
                'reason', 'insufficient_permissions',
                'required_role', 'hr_manager_or_admin',
                'ip_address', inet_client_addr()
            )
        );
        RETURN;
    END IF;
    
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
        'hr_authorized_access',
        jsonb_build_object(
            'scope', CASE WHEN _employee_id IS NULL THEN 'all_employees' ELSE 'single_employee' END,
            'access_level', 'full_sensitive_data'
        )
    );
END;
$$;

-- Remove the employee self-service emergency contact update function
-- This data is now strictly controlled by HR only
DROP FUNCTION IF EXISTS public.update_employee_emergency_contact(uuid, text, text);

-- Create a secure HR-only function for updating employee data
CREATE OR REPLACE FUNCTION public.update_employee_data_hr_only(
    _employee_id uuid,
    _employee_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_has_hr_access boolean := false;
    updated_fields text[] := ARRAY[]::text[];
BEGIN
    -- Verify HR access
    user_has_hr_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role)
    );
    
    IF NOT user_has_hr_access THEN
        -- Log unauthorized access attempt
        PERFORM public.log_employee_data_access(
            _employee_id,
            current_user_id,
            'unauthorized_update_attempt',
            jsonb_build_object(
                'reason', 'insufficient_permissions',
                'attempted_data', _employee_data
            )
        );
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: HR permissions required');
    END IF;
    
    -- Check if employee record exists
    IF NOT EXISTS (SELECT 1 FROM public.employee_sensitive_data WHERE id = _employee_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Employee record not found');
    END IF;
    
    -- Update employee data (HR can update all fields)
    UPDATE public.employee_sensitive_data 
    SET 
        employee_id = COALESCE(_employee_data->>'employee_id', employee_id),
        department = COALESCE(_employee_data->>'department', department),
        manager_id = COALESCE((_employee_data->>'manager_id')::uuid, manager_id),
        hire_date = COALESCE((_employee_data->>'hire_date')::date, hire_date),
        salary_band = COALESCE(_employee_data->>'salary_band', salary_band),
        security_clearance = COALESCE(_employee_data->>'security_clearance', security_clearance),
        emergency_contact_name = COALESCE(_employee_data->>'emergency_contact_name', emergency_contact_name),
        emergency_contact_phone = COALESCE(_employee_data->>'emergency_contact_phone', emergency_contact_phone),
        home_address = COALESCE(_employee_data->>'home_address', home_address),
        social_security_partial = COALESCE(_employee_data->>'social_security_partial', social_security_partial),
        data_classification = COALESCE(_employee_data->>'data_classification', data_classification),
        updated_at = now()
    WHERE id = _employee_id;
    
    -- Log the update with changed fields
    PERFORM public.log_employee_data_access(
        _employee_id,
        current_user_id,
        'hr_data_update',
        jsonb_build_object(
            'updated_data', _employee_data,
            'update_timestamp', now()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Employee data updated successfully by HR personnel'
    );
END;
$$;

-- Create a read-only function for managers to get basic employee info (non-sensitive)
-- This allows managers to see basic info about their reports without sensitive data
CREATE OR REPLACE FUNCTION public.get_employee_basic_info(_employee_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
    id uuid,
    employee_id text,
    department text,
    hire_date date,
    security_clearance text,
    data_classification text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_has_access boolean := false;
BEGIN
    -- Check if user has access (HR, admin, or manager of the employee)
    user_has_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role) OR
        has_role(current_user_id, 'production_manager'::app_role) OR
        -- Allow managers to see basic info of their direct reports
        (_employee_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.employee_sensitive_data 
            WHERE id = _employee_id AND manager_id = current_user_id
        ))
    );
    
    IF NOT user_has_access THEN
        RETURN;
    END IF;
    
    -- Return only basic, non-sensitive information
    RETURN QUERY
    SELECT 
        esd.id, 
        esd.employee_id, 
        esd.department, 
        esd.hire_date,
        esd.security_clearance,
        esd.data_classification
    FROM public.employee_sensitive_data esd
    WHERE (_employee_id IS NULL OR esd.id = _employee_id)
    ORDER BY esd.employee_id;
    
    -- Log access to basic info
    PERFORM public.log_employee_data_access(
        COALESCE(_employee_id, '00000000-0000-0000-0000-000000000000'::uuid),
        current_user_id,
        'basic_info_access',
        jsonb_build_object(
            'data_type', 'non_sensitive_only',
            'scope', CASE WHEN _employee_id IS NULL THEN 'multiple_employees' ELSE 'single_employee' END
        )
    );
END;
$$;

-- Enhanced security alert for sensitive data access
CREATE OR REPLACE FUNCTION public.create_sensitive_data_alert(_alert_details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.security_alerts (
        alert_type,
        severity,
        details,
        created_at
    ) VALUES (
        'sensitive_employee_data_access',
        'critical',
        _alert_details || jsonb_build_object(
            'timestamp', now(),
            'ip_address', inet_client_addr(),
            'security_policy', 'hr_only_access'
        ),
        now()
    );
END;
$$;

-- Update the audit function to create alerts for suspicious access
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
        accessed_at,
        risk_level
    ) VALUES (
        _employee_id,
        _accessed_by,
        _access_type,
        'Employee sensitive data access - HR only policy',
        inet_client_addr(),
        now(),
        CASE 
            WHEN _access_type LIKE '%denied%' OR _access_type LIKE '%unauthorized%' THEN 'critical'
            WHEN _access_type = 'hr_authorized_access' THEN 'medium'
            ELSE 'high'
        END
    );
    
    -- Create security alert for unauthorized access attempts
    IF _access_type LIKE '%denied%' OR _access_type LIKE '%unauthorized%' THEN
        PERFORM public.create_sensitive_data_alert(
            jsonb_build_object(
                'user_id', _accessed_by,
                'employee_id', _employee_id,
                'access_type', _access_type,
                'details', _details,
                'alert_message', 'Unauthorized attempt to access sensitive employee data'
            )
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore audit logging errors to prevent blocking main operations
        NULL;
END;
$$;

COMMENT ON TABLE public.employee_sensitive_data IS 'STRICTLY CONFIDENTIAL: Contains highly sensitive employee personal information including SSNs, home addresses, and salary data. Access is LIMITED TO HR PERSONNEL ONLY. All access is logged and monitored for security compliance.';