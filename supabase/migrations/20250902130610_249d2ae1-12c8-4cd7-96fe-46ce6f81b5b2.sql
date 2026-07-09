-- Fix critical security vulnerability: Remove unsecured view that exposes manufacturing data
-- The raw_material_usage_stats view bypasses security since views cannot have RLS policies
-- Access to this sensitive data should only be through the secured get_raw_material_usage_stats() function

-- Drop the unsecured view that exposes sensitive manufacturing intelligence
DROP VIEW IF EXISTS public.raw_material_usage_stats;

-- The existing get_raw_material_usage_stats() function already provides secure access to this data
-- It properly checks for admin or production_manager roles before returning usage statistics
-- This ensures that sensitive manufacturing data like supplier names, usage patterns, 
-- and production volumes are only accessible to authorized users

-- Add a comment to document why we removed the view
COMMENT ON FUNCTION public.get_raw_material_usage_stats() IS 
'Secure function for accessing raw material usage statistics. 
Requires admin or production_manager role. 
The raw_material_usage_stats view was removed for security reasons as it bypassed access controls.';