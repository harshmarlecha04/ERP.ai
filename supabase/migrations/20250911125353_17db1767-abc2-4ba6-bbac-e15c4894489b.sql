-- Fix security vulnerability: Remove unnecessary HR manager access to supplier contact data
-- HR managers don't need access to sensitive supplier email/phone information

-- Drop the overly permissive policy that allows HR managers to view supplier data
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure supplier access for viewing" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create a more secure policy that only allows admins and production managers
DO $pol$ BEGIN DROP POLICY IF EXISTS "Restricted supplier access for essential roles only" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Restricted supplier access for essential roles only" 
ON public.suppliers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Add audit logging for supplier data access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_supplier_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_supplier_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log access to supplier contact data for security auditing
    INSERT INTO public.security_alerts (
        alert_type,
        severity,
        details,
        created_at
    ) VALUES (
        'supplier_data_access',
        'low',
        jsonb_build_object(
            'user_id', auth.uid(),
            'supplier_id', NEW.id,
            'supplier_name', NEW.name,
            'access_time', now(),
            'has_email_data', (NEW.emails IS NOT NULL AND jsonb_array_length(NEW.emails) > 0),
            'has_phone_data', (NEW.phone_numbers IS NOT NULL AND jsonb_array_length(NEW.phone_numbers) > 0)
        ),
        now()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to log supplier data access
DROP TRIGGER IF EXISTS audit_supplier_access ON public.suppliers;
DROP TRIGGER IF EXISTS audit_supplier_access ON public.suppliers;
-- (removed: Postgres does not support SELECT triggers)

-- Add comment to document the security change
COMMENT ON TABLE public.suppliers IS 'Supplier contact data table with restricted access. Contains sensitive email and phone information limited to admins and production managers only.';