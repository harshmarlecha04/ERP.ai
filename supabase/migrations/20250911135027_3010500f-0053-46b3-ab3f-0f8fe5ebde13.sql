-- Fix trigger syntax and finalize supplier security protection

-- Create a trigger to log data modification attempts (not SELECT)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_supplier_modifications' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_supplier_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log any data modification for security monitoring
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), 
        COALESCE(NEW.id, OLD.id),
        CONCAT('modify_', TG_OP::text),
        'data_modification_audit',
        'high'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the monitoring trigger for modifications only
DROP TRIGGER IF EXISTS supplier_modification_monitor ON public.suppliers;
DROP TRIGGER IF EXISTS supplier_modification_monitor ON public.suppliers;
CREATE TRIGGER supplier_modification_monitor
    AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.log_supplier_modifications();

-- Create a function to check suspicious access patterns
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='detect_suspicious_supplier_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.detect_suspicious_supplier_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    suspicious_count integer;
BEGIN
    -- Only proceed if user is authenticated
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;
    
    -- Check for multiple denied access attempts in the last hour
    SELECT COUNT(*) INTO suspicious_count
    FROM public.supplier_access_audit
    WHERE access_type = 'access_denied'
    AND accessed_at > now() - interval '1 hour'
    AND accessed_by = auth.uid();
    
    -- If more than 3 denied attempts, create a security alert
    IF suspicious_count >= 3 THEN
        INSERT INTO public.security_alerts (alert_type, severity, details)
        VALUES (
            'suspicious_supplier_access',
            'high',
            jsonb_build_object(
                'user_id', auth.uid(),
                'denied_attempts', suspicious_count,
                'time_window', '1 hour',
                'alert_reason', 'Multiple unauthorized supplier access attempts detected - possible data theft attempt'
            )
        );
    END IF;
END;
$$;

-- Update the secure function with enhanced security monitoring
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_accessible_suppliers' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_accessible_suppliers(_user_id uuid)
RETURNS TABLE(
    id uuid,
    name text,
    contact_info text,
    emails jsonb,
    phone_numbers jsonb,
    notes text,
    vetting_link text,
    address text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- CRITICAL SECURITY: Only essential roles can access supplier contact info
    IF NOT (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized access attempt with high risk level
        INSERT INTO public.supplier_access_audit (
            accessed_by, supplier_id, access_type, access_reason, risk_level
        ) VALUES (
            _user_id, NULL, 'access_denied', 'insufficient_permissions_contact_theft_prevention', 'high'
        );
        
        -- Check for suspicious activity patterns
        PERFORM public.detect_suspicious_supplier_access();
        
        RAISE EXCEPTION 'SECURITY VIOLATION: Access to supplier contact information denied. Only administrators and production managers can view email addresses and phone numbers. This incident has been logged for security monitoring.';
    END IF;
    
    -- Log authorized access for compliance audit trail
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, NULL, 'authorized_contact_access', 'legitimate_business_need', 'medium'
    );
    
    -- Return suppliers with full contact information for authorized users
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.contact_info,
        s.emails,
        s.phone_numbers,
        s.notes,
        s.vetting_link,
        s.address,
        s.created_at,
        s.updated_at
    FROM public.suppliers s
    ORDER BY s.name;
END;
$$;

-- Final security documentation
COMMENT ON FUNCTION public.get_accessible_suppliers(uuid) IS 'SECURITY-CRITICAL: Secure access function for supplier contact information. Prevents unauthorized access to emails and phone numbers that could be used for spam or impersonation. All access attempts are logged for security monitoring and compliance.';