-- Fix the formula_access_audit constraint to include missing access types
ALTER TABLE public.formula_access_audit 
DROP CONSTRAINT IF EXISTS formula_access_audit_access_type_check;

ALTER TABLE public.formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_access_type_check;
ALTER TABLE public.formula_access_audit 
ADD CONSTRAINT formula_access_audit_access_type_check 
CHECK (access_type = ANY (ARRAY[
  'view', 'edit', 'delete', 'create', 'update', 
  'admin_access', 'rd_manager_access', 'explicit_permission_access', 
  'role_based_access', 'trade_secret_access', 'access_denied_emergency', 
  'access_denied_hours', 'access_denied_no_permission', 'access_denied_confidential', 
  'access_denied_general', 'permission_granted', 'access_requested',
  -- Add missing access types that might be used
  'purchase_order_update', 'purchase_order_create', 'purchase_order_view',
  'purchase_order_delete', 'status_change', 'mark_received'
]));