-- Check if there are multiple save_formula functions and drop the conflicting one
DO $$
BEGIN
    -- Drop any existing save_formula function with only one parameter
    DROP FUNCTION IF EXISTS public.save_formula(jsonb);
    
    -- Ensure we only have the correct function with both parameters
    -- The function with DEFAULT parameter should handle both cases
END $$;