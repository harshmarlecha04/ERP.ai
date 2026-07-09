-- Drop and recreate the function to only count "ordered" status POs for totalValue
DROP FUNCTION IF EXISTS public.get_purchase_order_stats_with_items_secure();

CREATE FUNCTION public.get_purchase_order_stats_with_items_secure()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  has_access BOOLEAN := false;
  user_email TEXT;
  user_role TEXT;
BEGIN
  -- Get current user's email and role
  SELECT p.email, r.role INTO user_email, user_role
  FROM public.profiles p
  LEFT JOIN public.user_roles r ON r.user_id = p.id
  WHERE p.id = auth.uid();
  
  -- Check if user has financial access (admin, production_manager, or whitelisted emails)
  IF user_role IN ('admin', 'production_manager') THEN
    has_access := true;
  ELSIF user_email IN ('mfg@pharmvista.com', 'it@pharmvista.com', 'bizops@pharmvista.com', 'licensing@pharmvista.com') THEN
    has_access := true;
  END IF;
  
  -- Build the result with conditional financial data
  -- totalValue now only counts POs with status = 'ordered' (pending/not yet received)
  SELECT json_build_object(
    'totalOrders', (SELECT COUNT(*) FROM purchase_orders),
    'pendingOrders', (SELECT COUNT(*) FROM purchase_orders WHERE status = 'ordered'),
    'shippedOrders', 0,
    'deliveredOrders', (SELECT COUNT(*) FROM purchase_orders WHERE status = 'received'),
    'totalValue', CASE WHEN has_access THEN COALESCE((SELECT SUM(invoice_total) FROM purchase_orders WHERE status = 'ordered'), 0) ELSE 0 END,
    'monthlyValue', CASE WHEN has_access THEN COALESCE((
      SELECT SUM(invoice_total) 
      FROM purchase_orders 
      WHERE status = 'ordered' AND ordered_date >= date_trunc('month', CURRENT_DATE)
    ), 0) ELSE 0 END,
    'hasFinancialAccess', has_access
  ) INTO result;
  
  RETURN result;
END;
$$;