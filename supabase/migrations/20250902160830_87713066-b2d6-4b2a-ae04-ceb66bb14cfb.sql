-- Fix financial data security vulnerability: Restrict purchase orders access to authorized roles only

-- Drop the overly permissive policies for purchase_orders
DROP POLICY IF EXISTS "All authenticated users can view purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "All authenticated users can create purchase orders" ON public.purchase_orders;  
DROP POLICY IF EXISTS "All authenticated users can update purchase orders" ON public.purchase_orders;

-- Create role-based policies for financial data protection
CREATE POLICY "Only authorized roles can view purchase orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only authorized roles can create purchase orders"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only authorized roles can update purchase orders"
ON public.purchase_orders
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