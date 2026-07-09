-- Add audit logging for customers table access for additional security layer
-- This provides visibility into who accesses customer data and when

-- Create customers access audit table
CREATE TABLE IF NOT EXISTS public.customers_access_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_email TEXT,
    details JSONB
);

-- Enable RLS on audit table - only admins can view audit logs
DO $rls$ BEGIN ALTER TABLE public.customers_access_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can view customer access audit" ON public.customers_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can view customer access audit"
ON public.customers_access_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create function to log customer data modifications
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_customer_modification' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_customer_modification()
RETURNS TRIGGER
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
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.customers_access_audit (customer_id, user_id, access_type, user_email, details)
        VALUES (NEW.id, auth.uid(), 'INSERT', v_user_email, jsonb_build_object('company_name', NEW.company_name));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.customers_access_audit (customer_id, user_id, access_type, user_email, details)
        VALUES (NEW.id, auth.uid(), 'UPDATE', v_user_email, jsonb_build_object(
            'company_name', NEW.company_name,
            'changes', jsonb_build_object(
                'old_company_name', OLD.company_name,
                'new_company_name', NEW.company_name
            )
        ));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.customers_access_audit (customer_id, user_id, access_type, user_email, details)
        VALUES (OLD.id, auth.uid(), 'DELETE', v_user_email, jsonb_build_object('company_name', OLD.company_name));
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create trigger for customer modifications
DROP TRIGGER IF EXISTS customers_modification_audit ON public.customers;
DROP TRIGGER IF EXISTS customers_modification_audit ON public.customers;
CREATE TRIGGER customers_modification_audit
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.log_customer_modification();

-- Add index for efficient querying of audit logs
CREATE INDEX IF NOT EXISTS idx_customers_access_audit_customer_id ON public.customers_access_audit(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_access_audit_user_id ON public.customers_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_access_audit_accessed_at ON public.customers_access_audit(accessed_at DESC);