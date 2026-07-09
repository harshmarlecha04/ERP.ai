-- Fix the function signature issue by dropping and recreating
-- Drop existing functions to allow return type changes

DROP FUNCTION IF EXISTS public.get_employee_sensitive_data_secure(text);
DROP FUNCTION IF EXISTS public.get_employee_critical_data(text);
DROP FUNCTION IF EXISTS public.update_employee_data_with_approval(text, jsonb);

-- Create secure RPC functions that handle encrypted employee data
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_employee_sensitive_data_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_employee_sensitive_data_secure(_employee_id TEXT DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    employee_id TEXT,
    full_name TEXT,
    email TEXT,
    phone_number TEXT,
    job_title TEXT,
    department TEXT,
    hire_date DATE,
    manager_id uuid,
    security_clearance TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    social_security_partial TEXT,
    salary_band TEXT,
    home_address TEXT,
    data_classification TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
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
            auth.uid(), COALESCE(_employee_id, 'all'), 'unauthorized_attempt', 'No valid role', 'critical'
        );
        
        RAISE EXCEPTION 'Access denied: HR manager or admin permissions required';
    END IF;

    -- Log authorized access
    INSERT INTO public.employee_sensitive_data_audit (
        accessed_by, employee_id, access_type, access_reason, risk_level,
        data_fields_accessed
    ) VALUES (
        auth.uid(), 
        COALESCE(_employee_id, 'all'), 
        'secure_view', 
        'Authorized data access with field-level encryption', 
        'high',
        ARRAY['social_security_encrypted', 'salary_band_encrypted', 'home_address_encrypted']
    );

    -- Return data with automatic decryption for authorized users
    RETURN QUERY
    SELECT 
        esd.id,
        esd.employee_id,
        esd.full_name,
        esd.email,
        esd.phone_number,
        esd.job_title,
        esd.department,
        esd.hire_date,
        esd.manager_id,
        esd.security_clearance,
        esd.emergency_contact_name,
        esd.emergency_contact_phone,
        -- Decrypt sensitive fields only for authorized users
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

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_employee_critical_data' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_employee_critical_data(_employee_id TEXT DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    employee_id TEXT,
    social_security_partial TEXT,
    salary_band TEXT,
    home_address TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_accessed_by uuid,
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can access critical data
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        -- Log unauthorized attempt to access critical data
        INSERT INTO public.employee_critical_data_audit (
            accessed_by, employee_id, access_type, access_reason, risk_level
        ) VALUES (
            auth.uid(), COALESCE(_employee_id, 'all'), 'unauthorized_critical_attempt', 'Non-admin access attempt', 'critical'
        );
        
        RAISE EXCEPTION 'Access denied: Administrator permissions required for critical data';
    END IF;

    -- Log critical data access
    INSERT INTO public.employee_critical_data_audit (
        accessed_by, employee_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), COALESCE(_employee_id, 'all'), 'admin_critical_access', 'Administrative access to encrypted critical data', 'critical'
    );

    -- Update access tracking
    UPDATE public.employee_critical_data 
    SET last_accessed_by = auth.uid(), 
        last_accessed_at = now(), 
        access_count = access_count + 1
    WHERE (_employee_id IS NULL OR employee_id = _employee_id);

    -- Return decrypted critical data for admins only
    RETURN QUERY
    SELECT 
        ecd.id,
        ecd.employee_id,
        -- Decrypt sensitive fields
        CASE 
            WHEN ecd.social_security_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(ecd.social_security_encrypted)
            ELSE ecd.social_security_partial
        END as social_security_partial,
        CASE 
            WHEN ecd.salary_band_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(ecd.salary_band_encrypted)
            ELSE ecd.salary_band
        END as salary_band,
        CASE 
            WHEN ecd.home_address_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(ecd.home_address_encrypted)
            ELSE ecd.home_address
        END as home_address,
        ecd.created_at,
        ecd.updated_at,
        ecd.last_accessed_by,
        ecd.last_accessed_at,
        ecd.access_count
    FROM public.employee_critical_data ecd
    WHERE (_employee_id IS NULL OR ecd.employee_id = _employee_id);
END;
$$;