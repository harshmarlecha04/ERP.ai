-- Create comprehensive financial data access controls

-- 1. First, create specific policies for financial vs operational data access
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can manage purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Allow all authenticated users to view operational data (hide financial fields)
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view operational purchase order data" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can view operational purchase order data"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Allow all authenticated users to insert/update/delete purchase orders
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can manage purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can manage purchase orders"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can update purchase orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All users can delete purchase orders"
ON public.purchase_orders
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. Create a view that excludes financial data for non-authorized users
CREATE OR REPLACE VIEW public.purchase_orders_operational AS
SELECT 
  id,
  vendor_id,
  ingredient_id,
  quantity,
  ordered_date,
  expected_delivery,
  created_by,
  created_at,
  updated_at,
  received_date,
  received_by,
  status,
  vendor_name,
  ingredient_name,
  uom,
  po_number,
  terms,
  tracking_number,
  -- Conditional financial data based on user role
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR 
         has_role(auth.uid(), 'finance'::app_role) OR 
         has_role(auth.uid(), 'procurement'::app_role) OR 
         has_role(auth.uid(), 'production_manager'::app_role)
    THEN invoice_total 
    ELSE NULL 
  END as invoice_total,
  
  -- Add a flag to indicate if user can see financial data
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR 
         has_role(auth.uid(), 'finance'::app_role) OR 
         has_role(auth.uid(), 'procurement'::app_role) OR 
         has_role(auth.uid(), 'production_manager'::app_role)
    THEN true 
    ELSE false 
  END as can_view_financial_data
FROM public.purchase_orders;

-- Enable RLS on the view
ALTER VIEW public.purchase_orders_operational SET (security_barrier = true);

-- 3. Create a function to check financial access permissions
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_financial_data' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.can_access_financial_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'finance', 'procurement', 'production_manager')
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'
  );
$$;

-- 4. Create a secure function to get purchase order stats with financial restrictions
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_purchase_order_stats_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_purchase_order_stats_secure()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id uuid := auth.uid();
    has_financial_access boolean;
    result jsonb;
    total_orders integer;
    pending_orders integer;
    shipped_orders integer;
    delivered_orders integer;
    total_value numeric := 0;
    monthly_value numeric := 0;
BEGIN
    -- Check if user has financial access
    SELECT public.can_access_financial_data(user_id) INTO has_financial_access;
    
    -- Get basic counts (available to all users)
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'shipped'),
        COUNT(*) FILTER (WHERE status = 'delivered')
    INTO total_orders, pending_orders, shipped_orders, delivered_orders
    FROM public.purchase_orders;
    
    -- Get financial data only if user has access
    IF has_financial_access THEN
        SELECT 
            COALESCE(SUM(invoice_total), 0),
            COALESCE(SUM(CASE 
                WHEN EXTRACT(MONTH FROM ordered_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(YEAR FROM ordered_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                THEN invoice_total 
                ELSE 0 
            END), 0)
        INTO total_value, monthly_value
        FROM public.purchase_orders;
    END IF;
    
    result := jsonb_build_object(
        'totalOrders', total_orders,
        'pendingOrders', pending_orders,
        'shippedOrders', shipped_orders,
        'deliveredOrders', delivered_orders,
        'totalValue', total_value,
        'monthlyValue', monthly_value,
        'hasFinancialAccess', has_financial_access
    );
    
    RETURN result;
END;
$$;

-- Grant usage on the view and function
GRANT SELECT ON public.purchase_orders_operational TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_order_stats_secure() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_financial_data(uuid) TO authenticated;