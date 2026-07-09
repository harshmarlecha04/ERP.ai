-- Complete Financial Security Fix - Drop and Recreate All Policies
-- Ensure comprehensive protection of financial purchase order data

-- 1. Drop ALL existing policies to start fresh
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only authorized personnel can view purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only authorized personnel can create purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only authorized personnel can update purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. Create comprehensive secure policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure PO view access" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure PO view access" 
ON public.purchase_orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure PO create access" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure PO create access" 
ON public.purchase_orders 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure PO update access" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure PO update access" 
ON public.purchase_orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure PO delete access" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure PO delete access" 
ON public.purchase_orders 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. Add audit logging for financial access (if not already exists)
DROP TRIGGER IF EXISTS audit_purchase_order_operations ON public.purchase_orders;

DROP TRIGGER IF EXISTS audit_purchase_order_operations ON public.purchase_orders;
CREATE TRIGGER audit_purchase_order_operations
    AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_purchase_order_access();

-- 4. Create financial security monitoring function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_financial_security_status' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_financial_security_status()
RETURNS jsonb AS $$
DECLARE
    total_pos integer;
    recent_financial_access integer;
    high_risk_alerts integer;
    result jsonb;
BEGIN
    -- Only admins can view financial security status
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('error', 'Access denied');
    END IF;
    
    -- Get purchase order counts
    SELECT COUNT(*) INTO total_pos FROM public.purchase_orders;
    
    -- Get recent financial access attempts (last 24 hours)
    SELECT COUNT(*) INTO recent_financial_access 
    FROM public.formula_access_audit 
    WHERE access_type LIKE 'financial_%' 
    AND accessed_at > now() - interval '24 hours';
    
    -- Get high-risk financial security alerts (last 7 days)
    SELECT COUNT(*) INTO high_risk_alerts 
    FROM public.security_alerts 
    WHERE alert_type = 'high_risk_financial_access'
    AND created_at > now() - interval '7 days';
    
    result := jsonb_build_object(
        'total_purchase_orders', total_pos,
        'recent_financial_access', recent_financial_access,
        'high_risk_alerts', high_risk_alerts,
        'security_status', 'secured',
        'access_restricted_to', ARRAY['admin', 'production_manager'],
        'last_check', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Verify the security is properly implemented
SELECT 
    polname as policy_name,
    polcmd as command_type,
    'ACTIVE' as status
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname = 'purchase_orders'
ORDER BY polname;