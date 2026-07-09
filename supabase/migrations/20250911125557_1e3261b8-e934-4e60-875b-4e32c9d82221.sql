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

-- Add comment to document the security change
COMMENT ON TABLE public.suppliers IS 'Supplier contact data table with restricted access. Contains sensitive email and phone information limited to admins and production managers only.';

-- Create a secure audit function for supplier access (can be called by application)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='audit_supplier_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.audit_supplier_access(supplier_id UUID, access_type TEXT DEFAULT 'view')
RETURNS VOID AS $$
BEGIN
    -- Only log if user has permission to access suppliers
    IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role) THEN
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
                'supplier_id', supplier_id,
                'access_type', access_type,
                'access_time', now(),
                'user_role', CASE 
                    WHEN has_role(auth.uid(), 'admin'::app_role) THEN 'admin'
                    WHEN has_role(auth.uid(), 'production_manager'::app_role) THEN 'production_manager'
                    ELSE 'unknown'
                END
            ),
            now()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;