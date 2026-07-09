-- Fix Security Definer View Issue
-- Drop the problematic purchase_orders_operational view that bypasses RLS
DROP VIEW IF EXISTS public.purchase_orders_operational;

-- The purchase_orders table already has proper RLS policies, so we don't need the view
-- Applications should query purchase_orders directly and handle financial data visibility in the application layer
-- or use a SECURITY DEFINER function if needed

-- Create a secure function to get purchase orders with proper financial data filtering
CREATE OR REPLACE FUNCTION public.get_purchase_orders_with_financial_access()
RETURNS TABLE(
    id uuid,
    vendor_id uuid,
    ingredient_id uuid,
    quantity numeric,
    ordered_date date,
    expected_delivery date,
    created_by uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    received_date date,
    received_by uuid,
    invoice_total numeric,
    status text,
    vendor_name text,
    ingredient_name text,
    uom text,
    po_number text,
    terms text,
    tracking_number text,
    can_view_financial_data boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    user_has_financial_access boolean := false;
BEGIN
    -- Check if user has permission to access financial data
    user_has_financial_access := (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'production_manager'::app_role)
    );
    
    -- Return purchase orders with conditional financial information
    RETURN QUERY
    SELECT 
        po.id,
        po.vendor_id,
        po.ingredient_id,
        po.quantity,
        po.ordered_date,
        po.expected_delivery,
        po.created_by,
        po.created_at,
        po.updated_at,
        po.received_date,
        po.received_by,
        -- Only return financial data if user has proper role
        CASE WHEN user_has_financial_access THEN po.invoice_total ELSE NULL::numeric END as invoice_total,
        po.status,
        po.vendor_name,
        po.ingredient_name,
        po.uom,
        po.po_number,
        po.terms,
        po.tracking_number,
        user_has_financial_access as can_view_financial_data
    FROM public.purchase_orders po
    ORDER BY po.created_at DESC;
END;
$$;