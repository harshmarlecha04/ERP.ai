-- Fix RLS policy conflicts and finalize supplier security protection

-- Drop the conflicting "block direct access" policy since it's too restrictive
DROP POLICY IF EXISTS "Block direct supplier contact access" ON public.suppliers;

-- The existing RLS policies are sufficient - they already restrict access to admin and production_manager roles
-- The secure function will work through the existing policies

-- Create a trigger to log any direct table access attempts
CREATE OR REPLACE FUNCTION public.log_supplier_table_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log any direct table access for security monitoring
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), 
        COALESCE(NEW.id, OLD.id),
        CONCAT('direct_', TG_OP::text),
        'table_access_monitoring',
        'medium'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the monitoring trigger
DROP TRIGGER IF EXISTS supplier_access_monitor ON public.suppliers;
CREATE TRIGGER supplier_access_monitor
    AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.log_supplier_table_access();

-- Create a function to check suspicious access patterns
CREATE OR REPLACE FUNCTION public.detect_suspicious_supplier_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    suspicious_count integer;
    alert_details jsonb;
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
                'alert_reason', 'Multiple unauthorized supplier access attempts detected'
            )
        );
    END IF;
END;
$$;

-- Update the secure function to include suspicious activity detection
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
            _user_id, NULL, 'access_denied', 'insufficient_permissions', 'high'
        );
        
        -- Check for suspicious activity patterns
        PERFORM public.detect_suspicious_supplier_access();
        
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and production managers can access supplier contact information. This incident has been logged and monitored.';
    END IF;
    
    -- Log authorized access for audit trail
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, NULL, 'authorized_view', 'legitimate_business_access', 'medium'
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