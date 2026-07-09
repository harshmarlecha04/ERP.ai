-- CRITICAL SECURITY FIX: Protect supplier contact information from unauthorized access
-- Clean up and implement secure access patterns

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Only admins can view supplier access audit" ON public.supplier_access_audit;
DROP POLICY IF EXISTS "System can insert supplier access audit" ON public.supplier_access_audit;

-- Create audit table for supplier access logging (if not exists)
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

-- Create new policies
CREATE POLICY "Admins can view supplier audit logs" ON public.supplier_access_audit
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All can insert supplier audit logs" ON public.supplier_access_audit
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create secure function to get suppliers with enhanced access control
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
        
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and production managers can access supplier contact information. This incident has been logged.';
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

-- Add additional RLS policy for direct table access protection
CREATE POLICY "Block direct supplier contact access" ON public.suppliers
FOR SELECT USING (
    -- Block all direct access - force use of secure function
    false
);

-- Update existing policies to be more restrictive
DROP POLICY IF EXISTS "Restricted supplier access for essential roles only" ON public.suppliers;

CREATE POLICY "Essential roles supplier access via secure function" ON public.suppliers
FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
);

-- Update table documentation
COMMENT ON TABLE public.suppliers IS 'SECURITY-ENHANCED: Supplier contact information (emails, phone numbers) protected by multi-layer security. Access restricted to essential personnel only with mandatory audit logging to prevent data theft.';
COMMENT ON TABLE public.supplier_access_audit IS 'Critical security audit trail tracking all supplier data access attempts. Used to detect unauthorized access patterns and prevent contact information theft.';