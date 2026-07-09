-- Check if log_purchase_order_access function exists and might be causing issues
SELECT p.proname, p.prosrc 
FROM pg_proc p 
WHERE p.proname = 'log_purchase_order_access';

-- Drop it if it exists and is problematic
DROP FUNCTION IF EXISTS public.log_purchase_order_access(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.log_purchase_order_access(uuid, uuid, text);