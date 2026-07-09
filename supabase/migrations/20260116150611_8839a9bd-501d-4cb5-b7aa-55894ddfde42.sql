-- Fix 1: Remove dangerous time-based public access on customer_inquiries (CRITICAL)
-- This policy allowed anonymous users to view inquiries created within 2 minutes
DROP POLICY IF EXISTS "Allow viewing recently created inquiries" ON public.customer_inquiries;

-- Fix 2: Remove overly broad profiles access policy if it exists
DROP POLICY IF EXISTS "Authenticated users can view basic public profile info" ON public.profiles;

-- Fix 3: Create audit logging table for sensitive data access
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email TEXT,
    table_accessed TEXT NOT NULL,
    record_id UUID,
    record_identifier TEXT,
    access_type TEXT NOT NULL,
    fields_accessed TEXT[],
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view access logs
CREATE POLICY "Only admins can view access logs"
ON public.sensitive_data_access_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Authenticated users can insert their own access logs
CREATE POLICY "Authenticated users can insert own access logs"
ON public.sensitive_data_access_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sensitive_access_user_time 
ON public.sensitive_data_access_log(user_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensitive_access_table 
ON public.sensitive_data_access_log(table_accessed, accessed_at DESC);

-- Fix 4: Create function to log sensitive data access (for customers/suppliers)
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
    p_table_name TEXT,
    p_record_id UUID DEFAULT NULL,
    p_record_identifier TEXT DEFAULT NULL,
    p_access_type TEXT DEFAULT 'view',
    p_fields_accessed TEXT[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- Get user email from profiles
    SELECT email INTO v_user_email 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    INSERT INTO public.sensitive_data_access_log (
        user_id,
        user_email,
        table_accessed,
        record_id,
        record_identifier,
        access_type,
        fields_accessed
    ) VALUES (
        auth.uid(),
        v_user_email,
        p_table_name,
        p_record_id,
        p_record_identifier,
        p_access_type,
        p_fields_accessed
    );
END;
$$;

-- Grant execute permission on the logging function
GRANT EXECUTE ON FUNCTION public.log_sensitive_data_access TO authenticated;