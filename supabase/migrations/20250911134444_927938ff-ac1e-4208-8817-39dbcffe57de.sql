-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.get_accessible_suppliers(uuid);
DROP FUNCTION IF EXISTS public.audit_supplier_access(uuid, text);
DROP FUNCTION IF EXISTS public.create_supplier_secure(text, text, jsonb, jsonb, text, text, text);

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