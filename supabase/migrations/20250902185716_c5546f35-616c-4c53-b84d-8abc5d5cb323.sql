-- Update purchase orders SELECT policy to restrict access to authorized roles only
DROP POLICY IF EXISTS "All authenticated users can view purchase orders" ON public.purchase_orders;

-- Create new restrictive policy for viewing purchase orders
CREATE POLICY "Only authorized roles can view purchase orders" 
ON public.purchase_orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- Log this security policy change
INSERT INTO public.security_alerts (
  alert_type,
  severity,
  details,
  created_at
) VALUES (
  'policy_security_update',
  'high',
  jsonb_build_object(
    'table', 'purchase_orders',
    'action', 'restricted_select_access',
    'previous_policy', 'all_authenticated_users',
    'new_policy', 'admin_and_production_manager_only',
    'reason', 'protect_financial_data'
  ),
  now()
);