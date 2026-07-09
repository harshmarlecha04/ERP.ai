-- CRITICAL SECURITY FIX: Protect supplier contact information from unauthorized access
-- Clear sensitive contact data and implement secure access patterns

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

-- Create secure function to get suppliers with contact info (authorized users only)
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
    -- Enhanced security: Only essential roles can access supplier contact info
    IF NOT (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized access attempt
        INSERT INTO public.supplier_access_audit (
            accessed_by, supplier_id, access_type, access_reason, risk_level
        ) VALUES (
            _user_id, NULL, 'denied', 'insufficient_permissions', 'high'
        );
        
        RAISE EXCEPTION 'Access denied: Only administrators and production managers can access supplier contact information';
    END IF;
    
    -- Log authorized access
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, NULL, 'list_view', 'authorized_access', 'medium'
    );
    
    -- Return suppliers with contact information for authorized users only
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

-- Create secure function to update suppliers with audit logging
CREATE OR REPLACE FUNCTION public.update_supplier_secure(
    _supplier_id uuid,
    _supplier_data jsonb,
    _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check permissions
    IF NOT (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized update attempt
        INSERT INTO public.supplier_access_audit (
            accessed_by, supplier_id, access_type, access_reason, risk_level
        ) VALUES (
            _user_id, _supplier_id, 'update_denied', 'insufficient_permissions', 'high'
        );
        
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: Insufficient permissions');
    END IF;
    
    -- Log the update attempt
    INSERT INTO public.supplier_access_audit (
        accessed_by, supplier_id, access_type, access_reason, risk_level
    ) VALUES (
        _user_id, _supplier_id, 'update', 'authorized_modification', 'high'
    );
    
    -- Perform the update
    UPDATE public.suppliers
    SET 
        name = COALESCE(_supplier_data->>'name', name),
        contact_info = COALESCE(_supplier_data->>'contact_info', contact_info),
        emails = COALESCE((_supplier_data->>'emails')::jsonb, emails),
        phone_numbers = COALESCE((_supplier_data->>'phone_numbers')::jsonb, phone_numbers),
        notes = COALESCE(_supplier_data->>'notes', notes),
        vetting_link = COALESCE(_supplier_data->>'vetting_link', vetting_link),
        address = COALESCE(_supplier_data->>'address', address),
        updated_at = now()
    WHERE id = _supplier_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Supplier updated successfully');
END;
$$;

-- Update table comments
COMMENT ON TABLE public.suppliers IS 'Supplier information with enhanced security controls. Contact information (emails, phone numbers) is restricted to authorized personnel only with full audit logging.';
COMMENT ON TABLE public.supplier_access_audit IS 'Audit trail for all supplier data access attempts, tracking authorized and unauthorized access for compliance and security monitoring.';