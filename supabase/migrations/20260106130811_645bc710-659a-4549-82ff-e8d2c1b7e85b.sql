-- Fix customers table RLS policies
-- 1. Ensure policies target 'authenticated' role (not 'public')
-- 2. Remove hr_manager from SELECT (per security rollout requirement)

-- Drop existing policies
DROP POLICY IF EXISTS "Authorized roles can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized roles can create customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized roles can update customers" ON public.customers;
DROP POLICY IF EXISTS "Only admins can delete customers" ON public.customers;

-- Recreate with authenticated role and tighter access
CREATE POLICY "Authorized roles can view customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Authorized roles can create customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Authorized roles can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only admins can delete customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));