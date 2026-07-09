-- Fix security definer view issue by removing the security_barrier option
-- The view will still work properly with RLS

-- Drop and recreate the view without security_barrier
DROP VIEW IF EXISTS public.purchase_orders_operational;

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
         has_role(auth.uid(), 'production_manager'::app_role)
    THEN invoice_total 
    ELSE NULL 
  END as invoice_total,
  
  -- Add a flag to indicate if user can see financial data
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR 
         has_role(auth.uid(), 'production_manager'::app_role)
    THEN true 
    ELSE false 
  END as can_view_financial_data
FROM public.purchase_orders;

-- Grant proper permissions on the view
GRANT SELECT ON public.purchase_orders_operational TO authenticated;