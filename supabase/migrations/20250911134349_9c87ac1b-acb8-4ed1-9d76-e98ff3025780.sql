-- CRITICAL SECURITY FIX: Enhanced access control and audit logging for supplier contact information
-- This addresses the vulnerability where email addresses and phone numbers could be accessed by hackers

-- Create audit table for supplier access logging
CREATE TABLE IF NOT EXISTS public.supplier_access_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_by uuid NOT NULL,
    supplier_id uuid,
    ip_address inet,
    accessed_at timestamp with time zone DEFAULT now(),
    access_type text NOT NULL,
    access_reason text,
    user_agent text,
    session_id text,
    risk_level text DEFAULT 'medium'::text
);

-- Enable RLS on the audit table
ALTER TABLE public.supplier_access_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view supplier access logs
CREATE POLICY "Only admins can view supplier access audit" ON public.supplier_access_audit
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert audit logs (for system logging)
CREATE POLICY "System can insert supplier access audit" ON public.supplier_access_audit
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create enhanced secure function to get suppliers with strict access control
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
DECLARE
    user_session_info jsonb;
BEGIN
    -- Enhanced security: Only essential roles can access supplier contact info
    IF NOT (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized access attempt with high risk level
        INSERT INTO public.supplier_access_audit (
            accessed_by, supplier_id, access_type, access_reason, risk_level
        ) VALUES (
            _user_id, NULL, 'denied', 'insufficient_permissions', 'critical'
        );
        
        RAISE EXCEPTION 'Access denied: Only administrators and production managers can access supplier contact information';
    END IF;
    
    -- Log authorized access for audit compliance
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, NULL, 'list_view', 'role_based_access', 'medium'
    );
    
    -- Return supplier data with enhanced security logging
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
    FROM public.suppliers s;
END;
$$;

-- Create secure function for supplier creation with audit logging  
CREATE OR REPLACE FUNCTION public.create_supplier_secure(
    _name text,
    _contact_info text DEFAULT NULL,
    _emails jsonb DEFAULT '[]'::jsonb,
    _phone_numbers jsonb DEFAULT '[]'::jsonb,
    _notes text DEFAULT NULL,
    _vetting_link text DEFAULT NULL,
    _address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    supplier_id uuid;
    result jsonb;
BEGIN
    -- Check permissions
    IF NOT (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'production_manager'::app_role)
    ) THEN
        RAISE EXCEPTION 'Access denied: Only administrators and production managers can create suppliers';
    END IF;
    
    -- Insert new supplier
    INSERT INTO public.suppliers (name, contact_info, emails, phone_numbers, notes, vetting_link, address)
    VALUES (_name, _contact_info, _emails, _phone_numbers, _notes, _vetting_link, _address)
    RETURNING id INTO supplier_id;
    
    -- Log supplier creation
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), supplier_id, 'create', 'new_supplier_added', 'medium'
    );
    
    RETURN jsonb_build_object(
        'success', true, 
        'supplier_id', supplier_id,
        'message', 'Supplier created successfully'
    );
END;
$$;

-- Update existing supplier access audit function
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
CREATE OR REPLACE FUNCTION public.log_supplier_table_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log any direct table operations
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
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
CREATE TRIGGER supplier_table_access_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.log_supplier_table_access();

-- Add table comment to document security enhancement
COMMENT ON TABLE public.suppliers IS 'Supplier contact information with enhanced access control, audit logging, and role-based permissions. Contact data is restricted to essential personnel only.';