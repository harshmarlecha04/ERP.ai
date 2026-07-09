-- Update purchase orders SELECT policy to restrict access to authorized roles only
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new restrictive policy for viewing purchase orders
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only authorized roles can view purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only authorized roles can view purchase orders" 
ON public.purchase_orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Log this security policy change
DO $aud$ BEGIN INSERT INTO public.security_alerts (
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
); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;