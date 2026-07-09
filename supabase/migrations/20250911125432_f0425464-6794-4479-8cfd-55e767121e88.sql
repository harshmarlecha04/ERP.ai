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