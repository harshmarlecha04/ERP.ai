-- Check what triggers are using the update_formula_access_stats function
SELECT trigger_name, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE action_statement ILIKE '%update_formula_access_stats%';

-- The error suggests there's a trigger trying to access is_deleted on purchase_orders
-- Let's check all triggers and remove any that might be incorrectly attached
SELECT trigger_name, event_object_table, event_manipulation, action_timing, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'purchase_orders' 
OR action_statement ILIKE '%is_deleted%';

-- If there are any triggers on purchase_orders, we need to drop them
DROP TRIGGER IF EXISTS update_formula_access_stats_trigger ON public.purchase_orders;
DROP TRIGGER IF EXISTS update_formula_access_stats ON public.purchase_orders;