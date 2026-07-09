-- Fix the formula_access_audit access_type check constraint to allow all valid access types
-- Drop the existing restrictive constraint
ALTER TABLE public.formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_access_type_check;

-- Add a new, more comprehensive constraint that allows all access types used in the system
ALTER TABLE public.formula_access_audit ADD CONSTRAINT formula_access_audit_access_type_check 
CHECK (access_type IN (
  'view', 'edit', 'create', 'update', 'delete', 'admin',
  'admin_access', 'rd_manager_access', 'explicit_permission_access', 
  'role_based_access', 'trade_secret_access', 'permission_granted',
  'access_denied_emergency', 'access_denied_hours', 'access_denied_no_permission',
  'access_denied_confidential', 'access_denied_general'
));