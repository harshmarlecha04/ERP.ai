-- Fix purchase orders RPC: remove join to non-existent vendors table and invalid received_at column
DROP FUNCTION IF EXISTS public.get_purchase_orders_with_business_hours_access();

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_purchase_orders_with_business_hours_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_purchase_orders_with_business_hours_access()
RETURNS TABLE (
  id uuid,
  po_number text,
  order_date date,
  expected_delivery date,
  actual_delivery_date date,
  status text,
  vendor_id uuid,
  vendor_name text,
  invoice_total numeric,
  payment_terms text,
  tracking_number text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  received_by uuid,
  received_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    po.id,
    po.po_number,
    po.ordered_date AS order_date,
    po.expected_delivery,
    po.received_date AS actual_delivery_date,
    po.status,
    po.vendor_id,
    po.vendor_name,
    CASE
      WHEN has_financial_access() THEN po.invoice_total
      ELSE NULL::numeric
    END AS invoice_total,
    po.terms AS payment_terms,
    po.tracking_number,
    po.created_at,
    po.updated_at,
    po.created_by,
    po.received_by,
    NULL::timestamptz AS received_at
  FROM public.purchase_orders po
  ORDER BY po.ordered_date DESC;
$$;