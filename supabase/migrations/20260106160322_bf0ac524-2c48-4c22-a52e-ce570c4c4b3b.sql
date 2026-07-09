-- Drop existing function and recreate with correct column mappings
DROP FUNCTION IF EXISTS public.get_purchase_orders_with_business_hours_access();

CREATE OR REPLACE FUNCTION public.get_purchase_orders_with_business_hours_access()
RETURNS TABLE (
  id uuid,
  order_date date,
  expected_delivery_date date,
  actual_delivery_date date,
  status text,
  vendor_id uuid,
  vendor_name text,
  invoice_total numeric,
  payment_terms text,
  payment_due_date date,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  received_by uuid,
  received_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id,
    po.ordered_date AS order_date,
    po.expected_delivery AS expected_delivery_date,
    po.received_date AS actual_delivery_date,
    po.status,
    po.vendor_id,
    v.name AS vendor_name,
    CASE 
      WHEN has_financial_access() THEN po.invoice_total
      ELSE NULL::numeric
    END AS invoice_total,
    po.terms AS payment_terms,
    NULL::date AS payment_due_date,
    NULL::text AS notes,
    po.created_at,
    po.updated_at,
    po.created_by,
    po.received_by,
    po.received_at
  FROM purchase_orders po
  LEFT JOIN vendors v ON v.id = po.vendor_id
  ORDER BY po.ordered_date DESC;
END;
$$;