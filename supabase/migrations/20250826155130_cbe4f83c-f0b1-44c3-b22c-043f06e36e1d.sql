-- Fix the check constraint on formula_access_audit table to allow admin_access
ALTER TABLE formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_access_type_check;

-- Add the updated check constraint that includes admin_access
ALTER TABLE formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_access_type_check;
ALTER TABLE formula_access_audit ADD CONSTRAINT formula_access_audit_access_type_check 
CHECK (access_type IN ('view', 'edit', 'delete', 'create', 'admin_access'));