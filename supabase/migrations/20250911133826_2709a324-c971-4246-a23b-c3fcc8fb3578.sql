-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.get_employee_sensitive_data_secure(text);
DROP FUNCTION IF EXISTS public.get_employee_critical_data(text);
DROP FUNCTION IF EXISTS public.update_employee_data_with_approval(text, jsonb);

-- Create secure RPC functions to handle encrypted employee data
-- These functions ensure proper access control and audit logging

CREATE OR REPLACE FUNCTION public.get_employee_sensitive_data_secure(_employee_id TEXT DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    employee_id text,
    full_name text,
    email text,
    phone_number text,
    job_title text,
    department text,
    manager_id uuid,
    hire_date date,
    security_clearance text,
    emergency_contact_name text,
    emergency_contact_phone text,
    -- Return decrypted sensitive fields only to authorized users
    social_security_partial text,
    salary_band text,
    home_address text,
    data_classification text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Enhanced access control with audit logging
    IF NOT (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'hr_manager'::app_role)
    ) THEN
        -- Log unauthorized access attempt
        INSERT INTO public.employee_sensitive_data_audit (
            accessed_by, employee_id, access_type, access_reason, risk_level
        ) VALUES (
            auth.uid(), COALESCE(_employee_id, 'ALL'), 'denied', 'insufficient_permissions', 'high'
        );
        
        RAISE EXCEPTION 'Access denied: HR manager or admin permissions required';
    END IF;
    
    -- Log authorized access
    INSERT INTO public.employee_sensitive_data_audit (
        accessed_by, employee_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), COALESCE(_employee_id, 'ALL'), 'view', 'authorized_access', 'medium'
    );
    
    RETURN QUERY
    SELECT 
        esd.id,
        esd.employee_id,
        esd.full_name,
        esd.email,
        esd.phone_number,
        esd.job_title,
        esd.department,
        esd.manager_id,
        esd.hire_date,
        esd.security_clearance,
        esd.emergency_contact_name,
        esd.emergency_contact_phone,
        -- Use encrypted fields with secure decryption
        CASE 
            WHEN esd.social_security_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(esd.social_security_encrypted)
            ELSE esd.social_security_partial
        END as social_security_partial,
        CASE 
            WHEN esd.salary_band_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(esd.salary_band_encrypted)
            ELSE esd.salary_band
        END as salary_band,
        CASE 
            WHEN esd.home_address_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(esd.home_address_encrypted)
            ELSE esd.home_address
        END as home_address,
        esd.data_classification,
        esd.created_at,
        esd.updated_at
    FROM public.employee_sensitive_data esd
    WHERE (_employee_id IS NULL OR esd.employee_id = _employee_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_critical_data(_employee_id TEXT DEFAULT NULL)
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
BEGIN
    -- Only admins can access critical data
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        -- Log unauthorized access attempt
        INSERT INTO public.employee_critical_data_audit (
            accessed_by, employee_id, access_type, access_reason, risk_level
        ) VALUES (
            auth.uid(), COALESCE(_employee_id, 'ALL'), 'denied', 'admin_access_required', 'critical'
        );
        
        RAISE EXCEPTION 'Access denied: Administrator permissions required for critical employee data';
    END IF;
    
    -- Log authorized critical data access
    INSERT INTO public.employee_critical_data_audit (
        accessed_by, employee_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), COALESCE(_employee_id, 'ALL'), 'view', 'admin_access_granted', 'critical'
    );
    
    RETURN QUERY
    SELECT 
        ecd.id,
        ecd.employee_id,
        -- Always decrypt from encrypted fields for critical data
        COALESCE(
            public.decrypt_sensitive_field(ecd.social_security_encrypted),
            ecd.social_security_partial
        ) as social_security_partial,
        COALESCE(
            public.decrypt_sensitive_field(ecd.salary_band_encrypted),
            ecd.salary_band
        ) as salary_band,
        COALESCE(
            public.decrypt_sensitive_field(ecd.home_address_encrypted),
            ecd.home_address
        ) as home_address,
        ecd.created_at,
        ecd.updated_at
    FROM public.employee_critical_data ecd
    WHERE (_employee_id IS NULL OR ecd.employee_id = _employee_id);
END;
$$;

-- Create secure update functions that handle encryption
CREATE OR REPLACE FUNCTION public.update_employee_data_with_approval(
    _employee_id text,
    _employee_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Check HR permissions
    IF NOT has_role(auth.uid(), 'hr_manager'::app_role) AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: HR manager permissions required');
    END IF;
    
    -- Log the update attempt
    INSERT INTO public.employee_sensitive_data_audit (
        accessed_by, employee_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), _employee_id, 'update', 'data_modification', 'high'
    );
    
    -- Update non-critical fields and encrypt sensitive ones
    UPDATE public.employee_sensitive_data
    SET 
        full_name = COALESCE(_employee_data->>'full_name', full_name),
        email = COALESCE(_employee_data->>'email', email),
        phone_number = COALESCE(_employee_data->>'phone_number', phone_number),
        job_title = COALESCE(_employee_data->>'job_title', job_title),
        department = COALESCE(_employee_data->>'department', department),
        emergency_contact_name = COALESCE(_employee_data->>'emergency_contact_name', emergency_contact_name),
        emergency_contact_phone = COALESCE(_employee_data->>'emergency_contact_phone', emergency_contact_phone),
        -- Encrypt sensitive fields
        social_security_encrypted = CASE 
            WHEN _employee_data->>'social_security_partial' IS NOT NULL 
            THEN public.encrypt_sensitive_field(_employee_data->>'social_security_partial')
            ELSE social_security_encrypted
        END,
        salary_band_encrypted = CASE 
            WHEN _employee_data->>'salary_band' IS NOT NULL 
            THEN public.encrypt_sensitive_field(_employee_data->>'salary_band')
            ELSE salary_band_encrypted
        END,
        home_address_encrypted = CASE 
            WHEN _employee_data->>'home_address' IS NOT NULL 
            THEN public.encrypt_sensitive_field(_employee_data->>'home_address')
            ELSE home_address_encrypted
        END,
        updated_at = now()
    WHERE employee_id = _employee_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Employee data updated successfully');
END;
$$;