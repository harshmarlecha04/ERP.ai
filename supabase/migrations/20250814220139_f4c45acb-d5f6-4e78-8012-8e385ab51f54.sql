-- Fix Security Definer View issue by removing the secure_profiles view
-- The view was flagged by the linter because it uses a SECURITY DEFINER function
-- which bypasses normal RLS policies. Instead, we'll rely on the existing
-- get_sanitized_profile_data() function for secure profile access.

-- Drop the problematic view
DROP VIEW IF EXISTS public.secure_profiles;

-- The get_sanitized_profile_data() function already provides secure access
-- to profile data with proper access controls and audit logging.
-- Applications should use this function instead of the view:
-- SELECT * FROM public.get_sanitized_profile_data(uuid);

-- This approach is more secure because:
-- 1. No view with indirect SECURITY DEFINER behavior
-- 2. Explicit function calls make security auditing easier
-- 3. Built-in audit logging for all access attempts
-- 4. Proper data classification and sanitization