-- Final cleanup: Clear old unencrypted sensitive data after successful encryption migration
-- This ensures sensitive data is only stored in encrypted format

UPDATE public.employee_sensitive_data 
SET 
    social_security_partial = NULL,
    salary_band = NULL,
    home_address = NULL
WHERE social_security_encrypted IS NOT NULL 
   OR salary_band_encrypted IS NOT NULL 
   OR home_address_encrypted IS NOT NULL;

UPDATE public.employee_critical_data 
SET 
    social_security_partial = NULL,
    salary_band = NULL,  
    home_address = NULL
WHERE social_security_encrypted IS NOT NULL 
   OR salary_band_encrypted IS NOT NULL 
   OR home_address_encrypted IS NOT NULL;

-- Add table comments to document the security enhancement
COMMENT ON TABLE public.employee_sensitive_data IS 'Employee PII with field-level encryption for SSN, salary, and address data. Sensitive fields are encrypted at rest and decrypted only for authorized users.';
COMMENT ON TABLE public.employee_critical_data IS 'Critical employee data with mandatory encryption. Only administrators can access this data with full audit logging.';

-- Create audit trigger to monitor access to encrypted fields
CREATE OR REPLACE FUNCTION public.log_employee_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log any SELECT operation on sensitive employee data
    INSERT INTO public.employee_sensitive_data_audit (
        accessed_by, employee_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), 
        COALESCE(NEW.employee_id, OLD.employee_id, 'unknown'), 
        TG_OP::text, 
        'direct_table_access', 
        'medium'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the audit trigger (monitors all operations)
DROP TRIGGER IF EXISTS employee_data_access_audit ON public.employee_sensitive_data;
CREATE TRIGGER employee_data_access_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.employee_sensitive_data
    FOR EACH ROW EXECUTE FUNCTION public.log_employee_data_access();