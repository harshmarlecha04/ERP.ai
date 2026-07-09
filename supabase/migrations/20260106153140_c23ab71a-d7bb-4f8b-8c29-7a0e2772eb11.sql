-- Drop the existing function first due to signature mismatch
DROP FUNCTION IF EXISTS public.get_purchase_orders_with_business_hours_access();

-- Recreate the function with financial access control
CREATE OR REPLACE FUNCTION public.get_purchase_orders_with_business_hours_access()
RETURNS TABLE (
  id UUID,
  po_number TEXT,
  vendor_id UUID,
  order_date DATE,
  expected_delivery DATE,
  status TEXT,
  notes TEXT,
  invoice_total NUMERIC,
  payment_terms TEXT,
  payment_due_date DATE,
  tracking_number TEXT,
  actual_delivery_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return financial data (invoice_total) if user has financial access
  IF public.has_financial_access() THEN
    RETURN QUERY
    SELECT 
      po.id,
      po.po_number,
      po.vendor_id,
      po.order_date,
      po.expected_delivery,
      po.status,
      po.notes,
      po.invoice_total,
      po.payment_terms,
      po.payment_due_date,
      po.tracking_number,
      po.actual_delivery_date,
      po.created_at,
      po.updated_at,
      po.created_by
    FROM public.purchase_orders po;
  ELSE
    -- Return NULL for invoice_total if user doesn't have financial access
    RETURN QUERY
    SELECT 
      po.id,
      po.po_number,
      po.vendor_id,
      po.order_date,
      po.expected_delivery,
      po.status,
      po.notes,
      NULL::NUMERIC as invoice_total,
      po.payment_terms,
      po.payment_due_date,
      po.tracking_number,
      po.actual_delivery_date,
      po.created_at,
      po.updated_at,
      po.created_by
    FROM public.purchase_orders po;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_purchase_orders_with_business_hours_access() TO authenticated;