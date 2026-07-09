-- Complete the security fix by adding the audit function
-- The main security policy has already been successfully applied

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