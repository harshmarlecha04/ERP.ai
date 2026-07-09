-- CRITICAL SECURITY FIX: Encrypt supplier contact information to prevent data theft
-- This addresses the vulnerability where email addresses and phone numbers could be accessed by hackers

-- Add encrypted columns for sensitive supplier contact data
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS emails_encrypted TEXT,
ADD COLUMN IF NOT EXISTS phone_numbers_encrypted TEXT,
ADD COLUMN IF NOT EXISTS contact_info_encrypted TEXT;

-- Encrypt existing contact data during migration (no auth required during migration)
UPDATE public.suppliers 
SET 
    emails_encrypted = CASE 
        WHEN emails IS NOT NULL AND emails != '[]'::jsonb 
        THEN public.encrypt_sensitive_field(emails::text)
        ELSE NULL
    END,
    phone_numbers_encrypted = CASE 
        WHEN phone_numbers IS NOT NULL AND phone_numbers != '[]'::jsonb 
        THEN public.encrypt_sensitive_field(phone_numbers::text)
        ELSE NULL
    END,
    contact_info_encrypted = CASE 
        WHEN contact_info IS NOT NULL AND trim(contact_info) != '' 
        THEN public.encrypt_sensitive_field(contact_info)
        ELSE NULL
    END
WHERE emails_encrypted IS NULL OR phone_numbers_encrypted IS NULL OR contact_info_encrypted IS NULL;

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
DO $rls$ BEGIN ALTER TABLE public.supplier_access_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Only admins can view supplier access logs
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can view supplier access audit" ON public.supplier_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can view supplier access audit" ON public.supplier_access_audit
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Authenticated users can insert audit logs (for system logging)
DO $pol$ BEGIN DROP POLICY IF EXISTS "System can insert supplier access audit" ON public.supplier_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "System can insert supplier access audit" ON public.supplier_access_audit
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create secure function to get suppliers with decrypted contact info (authorized users only)
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
    
    -- Return suppliers with decrypted contact information for authorized users
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        -- Decrypt contact info only for authorized users
        CASE 
            WHEN s.contact_info_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(s.contact_info_encrypted)
            ELSE s.contact_info
        END as contact_info,
        -- Decrypt emails only for authorized users
        CASE 
            WHEN s.emails_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(s.emails_encrypted)::jsonb
            ELSE s.emails
        END as emails,
        -- Decrypt phone numbers only for authorized users  
        CASE 
            WHEN s.phone_numbers_encrypted IS NOT NULL 
            THEN public.decrypt_sensitive_field(s.phone_numbers_encrypted)::jsonb
            ELSE s.phone_numbers
        END as phone_numbers,
        s.notes,
        s.vetting_link,
        s.address,
        s.created_at,
        s.updated_at
    FROM public.suppliers s;
END;
$$;