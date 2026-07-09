-- Complete the security implementation with additional functions and triggers

-- Enhanced supplier access audit function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='audit_supplier_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.audit_supplier_access(supplier_id uuid, access_type text DEFAULT 'view'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Enhanced logging with permission check
    IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role) THEN
        INSERT INTO public.supplier_access_audit (
            accessed_by,
            supplier_id,
            access_type,
            access_reason,
            risk_level
        ) VALUES (
            auth.uid(),
            supplier_id,
            access_type,
            'authorized_role_access',
            CASE 
                WHEN access_type IN ('delete', 'modify_contacts') THEN 'high'
                WHEN access_type IN ('update', 'view_contacts') THEN 'medium'
                ELSE 'low'
            END
        );
    ELSE
        -- Log unauthorized access attempts
        INSERT INTO public.supplier_access_audit (
            accessed_by,
            supplier_id,
            access_type,
            access_reason,
            risk_level
        ) VALUES (
            auth.uid(),
            supplier_id,
            'denied',
            'unauthorized_access_attempt',
            'critical'
        );
    END IF;
END;
$$;

-- Add trigger to automatically audit direct table access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_supplier_table_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_supplier_table_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log any direct table operations with enhanced detail
    INSERT INTO public.supplier_access_audit (
        accessed_by, 
        supplier_id, 
        access_type, 
        access_reason, 
        risk_level
    ) VALUES (
        auth.uid(), 
        COALESCE(NEW.id, OLD.id), 
        TG_OP::text, 
        'direct_table_access', 
        CASE 
            WHEN TG_OP = 'DELETE' THEN 'high'
            WHEN TG_OP = 'UPDATE' THEN 'medium'
            ELSE 'low'
        END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the audit trigger
DROP TRIGGER IF EXISTS supplier_table_access_audit ON public.suppliers;
DROP TRIGGER IF EXISTS supplier_table_access_audit ON public.suppliers;
CREATE TRIGGER supplier_table_access_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.log_supplier_table_access();

-- Create function to mask sensitive contact info for unauthorized users
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_suppliers_masked_for_role' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_suppliers_masked_for_role(_user_id uuid)
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
    updated_at timestamp with time zone,
    has_contact_access boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_access boolean := false;
BEGIN
    -- Check if user has access to contact information
    has_access := (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    );
    
    -- Log access attempt
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, NULL, 
        CASE WHEN has_access THEN 'authorized_view' ELSE 'masked_view' END,
        'role_based_filtering', 
        CASE WHEN has_access THEN 'low' ELSE 'medium' END
    );
    
    -- Return data with appropriate masking
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        -- Mask contact info for unauthorized users
        CASE 
            WHEN has_access THEN s.contact_info
            ELSE '[CONTACT INFO RESTRICTED]'
        END as contact_info,
        -- Mask emails for unauthorized users
        CASE 
            WHEN has_access THEN s.emails
            ELSE '[{"type": "restricted", "value": "[EMAIL RESTRICTED]"}]'::jsonb
        END as emails,
        -- Mask phone numbers for unauthorized users
        CASE 
            WHEN has_access THEN s.phone_numbers
            ELSE '[{"type": "restricted", "value": "[PHONE RESTRICTED]"}]'::jsonb
        END as phone_numbers,
        s.notes,
        s.vetting_link,
        s.address,
        s.created_at,
        s.updated_at,
        has_access as has_contact_access
    FROM public.suppliers s;
END;
$$;

-- Update table comment to document security enhancement
COMMENT ON TABLE public.suppliers IS 'Supplier information with multi-layer security: role-based access control, comprehensive audit logging, and contact information masking for unauthorized users. Only administrators and production managers can access sensitive contact data.';

-- Add index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_supplier_access_audit_user_time 
ON public.supplier_access_audit (accessed_by, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_access_audit_risk_level 
ON public.supplier_access_audit (risk_level, accessed_at DESC);

-- Create security alert function for suspicious activity
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_supplier_security_alerts' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.check_supplier_security_alerts()
RETURNS TABLE(
    alert_type text,
    alert_count bigint,
    latest_attempt timestamp with time zone,
    user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can check security alerts
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can view security alerts';
    END IF;
    
    -- Return suspicious access patterns
    RETURN QUERY
    SELECT 
        'multiple_denied_attempts'::text as alert_type,
        COUNT(*) as alert_count,
        MAX(accessed_at) as latest_attempt,
        accessed_by as user_id
    FROM public.supplier_access_audit
    WHERE access_type = 'denied' 
      AND accessed_at > (now() - interval '1 hour')
    GROUP BY accessed_by
    HAVING COUNT(*) >= 3;
END;
$$;