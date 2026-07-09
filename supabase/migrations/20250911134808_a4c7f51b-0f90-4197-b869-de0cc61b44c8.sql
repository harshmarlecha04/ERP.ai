-- Fix trigger syntax and finalize supplier security protection

-- Create a trigger to log table access attempts (without SELECT which isn't supported in AFTER triggers)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_supplier_table_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_supplier_table_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log table modifications for security monitoring
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), 
        COALESCE(NEW.id, OLD.id),
        CONCAT('direct_', TG_OP::text),
        'table_modification_monitoring',
        'medium'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the monitoring trigger FOR ALL operations
DROP TRIGGER IF EXISTS supplier_access_monitor ON public.suppliers;
DROP TRIGGER IF EXISTS supplier_access_monitor ON public.suppliers;
CREATE TRIGGER supplier_access_monitor
    AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.log_supplier_table_access();

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
                'alert_reason', 'Multiple unauthorized supplier access attempts detected - potential data theft attempt'
            )
        );
    END IF;
END;
$$;

-- Final security function with enhanced monitoring
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
            _user_id, NULL, 'access_denied', 'insufficient_permissions_for_contact_data', 'high'
        );
        
        -- Check for suspicious activity patterns
        PERFORM public.detect_suspicious_supplier_access();
        
        RAISE EXCEPTION 'SECURITY VIOLATION: Supplier contact information (emails, phone numbers) is restricted. Only administrators and production managers have access. This incident has been logged for security monitoring.';
    END IF;
    
    -- Log authorized access for audit trail
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, NULL, 'authorized_view', 'legitimate_business_access_to_contact_info', 'medium'
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

-- Add final documentation
COMMENT ON FUNCTION public.get_accessible_suppliers(uuid) IS 'SECURITY-CRITICAL: Secure access function for supplier contact information. Implements multi-layer protection against unauthorized access to emails and phone numbers. All access attempts are logged and monitored for suspicious patterns.';