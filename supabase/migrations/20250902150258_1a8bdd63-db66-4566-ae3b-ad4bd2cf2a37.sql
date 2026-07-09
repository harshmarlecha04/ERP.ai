-- Check for triggers on purchase_orders table that might call formula functions
SELECT trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'purchase_orders';

-- Drop the problematic foreign key constraint on formula_access_audit to stop blocking purchase orders
ALTER TABLE public.formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_formula_id_fkey;

-- Check if there's a function being called that shouldn't be
SELECT p.proname, p.prosrc 
FROM pg_proc p
WHERE p.prosrc ILIKE '%log_formula_access%' 
AND p.proname NOT IN ('log_formula_access');

-- Drop the log_formula_access function entirely since it's causing issues
DROP FUNCTION IF EXISTS public.log_formula_access(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.log_formula_access(uuid, uuid, text);