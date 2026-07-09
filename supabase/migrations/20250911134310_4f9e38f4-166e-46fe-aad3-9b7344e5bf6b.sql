-- Enable pgcrypto extension for encryption capabilities
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CRITICAL SECURITY FIX: Encrypt supplier contact information to prevent data theft
-- This addresses the vulnerability where email addresses and phone numbers could be accessed by hackers

-- Add encrypted columns for sensitive supplier contact data
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS emails_encrypted TEXT,
ADD COLUMN IF NOT EXISTS phone_numbers_encrypted TEXT,
ADD COLUMN IF NOT EXISTS contact_info_encrypted TEXT;

-- Encrypt existing contact data during migration
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