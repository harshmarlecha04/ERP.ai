-- Create approval workflows for HR access to sensitive employee data

-- Create table for HR data access requests
CREATE TABLE IF NOT EXISTS public.hr_data_access_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    employee_id TEXT NOT NULL,
    access_reason TEXT NOT NULL,
    access_type TEXT NOT NULL DEFAULT 'view', -- view, update
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    denied_by UUID,  
    denied_at TIMESTAMP WITH TIME ZONE,
    denial_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on HR data access requests
ALTER TABLE public.hr_data_access_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for HR data access requests
CREATE POLICY "HR managers can create access requests" ON public.hr_data_access_requests
    FOR INSERT WITH CHECK (
        has_role(auth.uid(), 'hr_manager'::app_role) AND 
        requester_id = auth.uid()
    );

CREATE POLICY "HR managers can view their own requests" ON public.hr_data_access_requests
    FOR SELECT USING (
        requester_id = auth.uid() OR 
        has_role(auth.uid(), 'admin'::app_role)
    );

CREATE POLICY "Only admins can approve/deny requests" ON public.hr_data_access_requests
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create table for tracking approved HR sessions
CREATE TABLE IF NOT EXISTS public.hr_sensitive_data_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.hr_data_access_requests(id),
    user_id UUID NOT NULL,
    employee_id TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    terminated_at TIMESTAMP WITH TIME ZONE,
    terminated_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on HR sessions
ALTER TABLE public.hr_sensitive_data_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for HR sessions
CREATE POLICY "Users can view their own HR sessions" ON public.hr_sensitive_data_sessions
    FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage HR sessions" ON public.hr_sensitive_data_sessions
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create audit table for sensitive data access
CREATE TABLE IF NOT EXISTS public.employee_sensitive_data_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    accessed_by UUID NOT NULL,
    employee_id TEXT NOT NULL,
    access_type TEXT NOT NULL, -- view, update, export
    access_reason TEXT,
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    risk_level TEXT DEFAULT 'high',
    data_fields_accessed TEXT[] -- array of field names accessed
);

-- Enable RLS on audit table
ALTER TABLE public.employee_sensitive_data_audit ENABLE ROW LEVEL SECURITY;

-- Create policies for audit table
CREATE POLICY "All authenticated users can insert audit logs" ON public.employee_sensitive_data_audit
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can view audit logs" ON public.employee_sensitive_data_audit
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create secure function to get employee sensitive data with approval workflow
CREATE OR REPLACE FUNCTION public.get_employee_sensitive_data(_employee_id TEXT DEFAULT NULL)
RETURNS TABLE(
    id UUID,
    employee_id TEXT,
    department TEXT,
    manager_id UUID,
    hire_date DATE,
    security_clearance TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    data_classification TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    valid_session_exists BOOLEAN := false;
    session_record RECORD;
BEGIN
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Not authenticated';
    END IF;
    
    -- Admins have direct access
    IF has_role(current_user_id, 'admin'::app_role) THEN
        -- Log admin access
        INSERT INTO public.employee_sensitive_data_audit (
            accessed_by, employee_id, access_type, access_reason, 
            ip_address, user_agent, risk_level
        ) VALUES (
            current_user_id, 
            COALESCE(_employee_id, 'all_employees'),
            'admin_view',
            'Administrative access',
            inet_client_addr(),
            current_setting('request.headers', true)::json->>'user-agent',
            'medium'
        );
        
        -- Return data for admins
        RETURN QUERY
        SELECT 
            esd.id, esd.employee_id, esd.department, esd.manager_id,
            esd.hire_date, esd.security_clearance, esd.emergency_contact_name,
            esd.emergency_contact_phone, esd.data_classification,
            esd.created_at, esd.updated_at
        FROM public.employee_sensitive_data esd
        WHERE (_employee_id IS NULL OR esd.employee_id = _employee_id);
        
        RETURN;
    END IF;
    
    -- For HR managers, check for valid approved session
    IF has_role(current_user_id, 'hr_manager'::app_role) THEN
        -- Check for active approved session
        SELECT * INTO session_record
        FROM public.hr_sensitive_data_sessions s
        JOIN public.hr_data_access_requests r ON r.id = s.request_id
        WHERE s.user_id = current_user_id
        AND s.is_active = true
        AND s.expires_at > now()
        AND r.status = 'approved'
        AND (_employee_id IS NULL OR s.employee_id = _employee_id)
        ORDER BY s.created_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            valid_session_exists := true;
            
            -- Log HR access with session info
            INSERT INTO public.employee_sensitive_data_audit (
                accessed_by, employee_id, access_type, access_reason,
                session_id, ip_address, user_agent, risk_level
            ) VALUES (
                current_user_id,
                COALESCE(_employee_id, session_record.employee_id),
                'hr_approved_view',
                'HR access with approved session',
                session_record.id,
                inet_client_addr(),
                current_setting('request.headers', true)::json->>'user-agent',
                'high'
            );
            
            -- Return data for approved HR access
            RETURN QUERY
            SELECT 
                esd.id, esd.employee_id, esd.department, esd.manager_id,
                esd.hire_date, esd.security_clearance, esd.emergency_contact_name,
                esd.emergency_contact_phone, esd.data_classification,
                esd.created_at, esd.updated_at
            FROM public.employee_sensitive_data esd
            WHERE (_employee_id IS NULL OR esd.employee_id = _employee_id)
            AND esd.employee_id = session_record.employee_id;
            
            RETURN;
        END IF;
        
        -- No valid session found - log denied access
        INSERT INTO public.employee_sensitive_data_audit (
            accessed_by, employee_id, access_type, access_reason,
            ip_address, user_agent, risk_level
        ) VALUES (
            current_user_id,
            COALESCE(_employee_id, 'unknown'),
            'hr_denied_view',
            'HR access denied - no valid approved session',
            inet_client_addr(),
            current_setting('request.headers', true)::json->>'user-agent',
            'critical'
        );
        
        RAISE EXCEPTION 'Access denied: HR access to sensitive employee data requires prior approval. Please submit an access request.';
    END IF;
    
    -- All other users are denied
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view sensitive employee data';
END;
$$;

-- Create secure function to update employee sensitive data with approval workflow  
CREATE OR REPLACE FUNCTION public.update_employee_data_hr_only(
    _employee_id TEXT,
    _employee_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    valid_session_exists BOOLEAN := false;
    session_record RECORD;
    result JSONB;
BEGIN
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Admins have direct access
    IF has_role(current_user_id, 'admin'::app_role) THEN
        -- Log admin update
        INSERT INTO public.employee_sensitive_data_audit (
            accessed_by, employee_id, access_type, access_reason,
            ip_address, user_agent, risk_level
        ) VALUES (
            current_user_id, _employee_id, 'admin_update', 'Administrative update',
            inet_client_addr(),
            current_setting('request.headers', true)::json->>'user-agent',
            'medium'
        );
        
        -- Perform update for admins
        UPDATE public.employee_sensitive_data 
        SET 
            department = COALESCE(_employee_data->>'department', department),
            manager_id = COALESCE((_employee_data->>'manager_id')::UUID, manager_id),
            hire_date = COALESCE((_employee_data->>'hire_date')::DATE, hire_date),
            security_clearance = COALESCE(_employee_data->>'security_clearance', security_clearance),
            emergency_contact_name = COALESCE(_employee_data->>'emergency_contact_name', emergency_contact_name),
            emergency_contact_phone = COALESCE(_employee_data->>'emergency_contact_phone', emergency_contact_phone),
            updated_at = now()
        WHERE employee_id = _employee_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'Employee data updated successfully');
    END IF;
    
    -- For HR managers, check for valid approved session with update permission
    IF has_role(current_user_id, 'hr_manager'::app_role) THEN
        -- Check for active approved session with update access
        SELECT * INTO session_record
        FROM public.hr_sensitive_data_sessions s
        JOIN public.hr_data_access_requests r ON r.id = s.request_id
        WHERE s.user_id = current_user_id
        AND s.employee_id = _employee_id
        AND s.is_active = true
        AND s.expires_at > now()
        AND r.status = 'approved'
        AND r.access_type IN ('update', 'admin')
        ORDER BY s.created_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            -- Log HR update with session info
            INSERT INTO public.employee_sensitive_data_audit (
                accessed_by, employee_id, access_type, access_reason,
                session_id, ip_address, user_agent, risk_level
            ) VALUES (
                current_user_id, _employee_id, 'hr_approved_update',
                'HR update with approved session',
                session_record.id,
                inet_client_addr(),
                current_setting('request.headers', true)::json->>'user-agent',
                'high'
            );
            
            -- Perform update for approved HR access
            UPDATE public.employee_sensitive_data 
            SET 
                department = COALESCE(_employee_data->>'department', department),
                manager_id = COALESCE((_employee_data->>'manager_id')::UUID, manager_id),
                hire_date = COALESCE((_employee_data->>'hire_date')::DATE, hire_date),
                security_clearance = COALESCE(_employee_data->>'security_clearance', security_clearance),
                emergency_contact_name = COALESCE(_employee_data->>'emergency_contact_name', emergency_contact_name),
                emergency_contact_phone = COALESCE(_employee_data->>'emergency_contact_phone', emergency_contact_phone),
                updated_at = now()
            WHERE employee_id = _employee_id;
            
            RETURN jsonb_build_object('success', true, 'message', 'Employee data updated successfully');
        END IF;
        
        -- Log denied update attempt
        INSERT INTO public.employee_sensitive_data_audit (
            accessed_by, employee_id, access_type, access_reason,
            ip_address, user_agent, risk_level
        ) VALUES (
            current_user_id, _employee_id, 'hr_denied_update',
            'HR update denied - no valid approved session',
            inet_client_addr(),
            current_setting('request.headers', true)::json->>'user-agent',
            'critical'
        );
        
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: HR updates to sensitive employee data require prior approval');
    END IF;
    
    -- All other users are denied
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: Insufficient permissions');
END;
$$;

-- Update RLS policies on employee_sensitive_data table to require approval workflow
DROP POLICY IF EXISTS "HR managers can view all employee data" ON public.employee_sensitive_data;
DROP POLICY IF EXISTS "HR managers can update all employee data" ON public.employee_sensitive_data;

-- Create new restrictive policies that require using the secure functions
CREATE POLICY "Only secure function access to sensitive data" ON public.employee_sensitive_data
    FOR ALL USING (false) WITH CHECK (false);

-- Grant execute permissions on the secure functions
GRANT EXECUTE ON FUNCTION public.get_employee_sensitive_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_data_hr_only TO authenticated;