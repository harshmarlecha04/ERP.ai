-- Check for any remaining problematic functions or triggers that reference is_deleted
-- This might be in a function that's still being called somewhere

-- Let's look for any functions that might be getting triggered
SELECT p.proname as function_name, p.prosrc as function_body
FROM pg_proc p 
WHERE p.prosrc ILIKE '%purchase_orders%' 
OR p.prosrc ILIKE '%NEW%' 
AND p.proname NOT LIKE 'pg_%';

-- Also check if there are any policies that might be calling functions
SELECT schemaname, tablename, policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'purchase_orders';