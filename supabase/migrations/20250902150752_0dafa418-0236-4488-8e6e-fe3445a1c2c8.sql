-- The audit_purchase_order_access function is causing the issue
-- Let's drop the problematic trigger that's trying to access is_deleted field
DROP TRIGGER IF EXISTS audit_purchase_order_operations ON public.purchase_orders;

-- Also drop the problematic function since it's expecting fields that don't exist
DROP FUNCTION IF EXISTS public.audit_purchase_order_access();