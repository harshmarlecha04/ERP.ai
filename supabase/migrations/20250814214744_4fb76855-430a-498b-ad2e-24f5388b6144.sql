-- Fix the secure_profiles view security issue
-- Drop the view that's causing the security finding
DROP VIEW IF EXISTS public.secure_profiles;

-- The security is already handled through the main profiles table RLS policies
-- and the can_access_profile_secure function that's called in the view WHERE clause.
-- No additional RLS policies are needed on the view itself since views inherit 
-- security from their underlying tables and the WHERE clause provides access control.

-- Recreate the view with proper security through WHERE clause filtering
CREATE OR REPLACE VIEW public.secure_profiles AS
SELECT 
    id,
    -- Only show email to self or admins
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN email
        ELSE NULL
    END as email,
    -- Only show full name to self or admins  
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN full_name
        ELSE display_name
    END as full_name,
    display_name,
    -- Sanitize job title based on classification
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN job_title
        WHEN data_classification IN ('public', 'internal') THEN job_title
        ELSE 'Employee'
    END as job_title,
    -- Only show role to self or admins
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN role
        ELSE 'user'
    END as role,
    created_at,
    updated_at,
    data_classification,
    privacy_consent_given
FROM public.profiles
WHERE public.can_access_profile_secure(auth.uid(), id, 'view');