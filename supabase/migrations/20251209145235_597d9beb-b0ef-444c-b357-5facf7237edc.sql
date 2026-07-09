-- Fix 1: Set security_invoker=true on v_packaging_balances view
ALTER VIEW public.v_packaging_balances SET (security_invoker = true);

-- Fix 2: Add admin access to profiles (so admins can manage users)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Restrict customers table access to appropriate roles only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;

-- Create role-restricted policies for customers
CREATE POLICY "Authorized roles can view customers" 
ON public.customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'hr_manager'::app_role)
);

CREATE POLICY "Authorized roles can create customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Authorized roles can update customers" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- Fix 4: Restrict customer_inquiries access to appropriate roles
-- Drop overly permissive policies  
DROP POLICY IF EXISTS "Authenticated users can view all inquiries" ON public.customer_inquiries;
DROP POLICY IF EXISTS "Authenticated users can update inquiries" ON public.customer_inquiries;
DROP POLICY IF EXISTS "Authenticated users can delete inquiries" ON public.customer_inquiries;

-- Create role-restricted policies for customer_inquiries
CREATE POLICY "Authorized roles can view inquiries" 
ON public.customer_inquiries 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'hr_manager'::app_role) OR
  assigned_to = auth.uid()
);

CREATE POLICY "Authorized roles can update inquiries" 
ON public.customer_inquiries 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  assigned_to = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  assigned_to = auth.uid()
);

CREATE POLICY "Authorized roles can delete inquiries" 
ON public.customer_inquiries 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Similarly restrict inquiry_messages and inquiry_order_details
DROP POLICY IF EXISTS "Authenticated users can view inquiry messages" ON public.inquiry_messages;
DROP POLICY IF EXISTS "Authenticated users can update inquiry messages" ON public.inquiry_messages;
DROP POLICY IF EXISTS "Authenticated users can delete inquiry messages" ON public.inquiry_messages;

CREATE POLICY "Authorized roles can view inquiry messages" 
ON public.inquiry_messages 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'hr_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM customer_inquiries ci 
    WHERE ci.id = inquiry_messages.inquiry_id 
    AND ci.assigned_to = auth.uid()
  )
);

CREATE POLICY "Authorized roles can update inquiry messages" 
ON public.inquiry_messages 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  sender_id = auth.uid()
);

CREATE POLICY "Authorized roles can delete inquiry messages" 
ON public.inquiry_messages 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view inquiry order details" ON public.inquiry_order_details;
DROP POLICY IF EXISTS "Authenticated users can update inquiry order details" ON public.inquiry_order_details;
DROP POLICY IF EXISTS "Authenticated users can delete inquiry order details" ON public.inquiry_order_details;

CREATE POLICY "Authorized roles can view inquiry order details" 
ON public.inquiry_order_details 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'hr_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM customer_inquiries ci 
    WHERE ci.id = inquiry_order_details.inquiry_id 
    AND ci.assigned_to = auth.uid()
  )
);

CREATE POLICY "Authorized roles can update inquiry order details" 
ON public.inquiry_order_details 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Authorized roles can delete inquiry order details" 
ON public.inquiry_order_details 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));