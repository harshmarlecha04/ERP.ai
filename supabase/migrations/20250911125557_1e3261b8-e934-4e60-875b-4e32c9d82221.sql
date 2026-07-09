-- Fix security vulnerability: Remove unnecessary HR manager access to supplier contact data
-- HR managers don't need access to sensitive supplier email/phone information

-- Drop the overly permissive policy that allows HR managers to view supplier data
DROP POLICY IF EXISTS "Secure supplier access for viewing" ON public.suppliers;

-- Create a more secure policy that only allows admins and production managers
CREATE POLICY "Restricted supplier access for essential roles only" 
ON public.suppliers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- Add comment to document the security change
COMMENT ON TABLE public.suppliers IS 'Supplier contact data table with restricted access. Contains sensitive email and phone information limited to admins and production managers only.';

-- Create a secure audit function for supplier access (can be called by application)
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
            'info',
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