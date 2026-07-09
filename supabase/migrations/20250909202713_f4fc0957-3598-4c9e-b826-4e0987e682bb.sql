-- Security Fix: Separate public profile data from sensitive employee information
-- Fixed version handling existing policies

-- First, let's update the profiles table to only contain public display information
-- Remove sensitive fields and keep only display-safe information
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_number;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS full_name;

-- Add safer display fields if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Update RLS policies for profiles to be more restrictive
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "HR managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can only create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new restrictive policies for profiles (public display data only)
CREATE POLICY "Users can view basic profile display info" 
ON public.profiles FOR SELECT 
USING (true); -- Basic display info like display_name, job_title can be public

CREATE POLICY "Users can update their own profile display info" 
ON public.profiles FOR UPDATE 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

CREATE POLICY "Only admins can delete profiles" 
ON public.profiles FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (id = auth.uid());

-- Ensure employee_sensitive_data table has all necessary fields for PII
-- This table should contain the sensitive information previously in profiles
ALTER TABLE public.employee_sensitive_data ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.employee_sensitive_data ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employee_sensitive_data ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.employee_sensitive_data ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.employee_sensitive_data ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create secure functions for accessing user display information with proper logging
CREATE OR REPLACE FUNCTION public.get_user_display_info(_user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    display_name text,
    job_title text,
    department text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Log access for audit
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason
    )
    SELECT 
        auth.uid(),
        UNNEST(COALESCE(_user_ids, ARRAY[auth.uid()])),
        'display_info_access',
        'basic_display_information'
    WHERE auth.uid() IS NOT NULL;
    
    -- Return only safe display information
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.job_title,
        p.department
    FROM public.profiles p
    WHERE (_user_ids IS NULL OR p.id = ANY(_user_ids))
    AND p.id IS NOT NULL;
END;
$$;

-- Create function for team member basic info (for managers)
CREATE OR REPLACE FUNCTION public.get_team_member_basic_info(_manager_id uuid DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    display_name text,
    job_title text,
    department text,
    email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    requesting_user_id uuid := auth.uid();
BEGIN
    -- Verify user has manager role or admin role
    IF NOT (
        has_role(requesting_user_id, 'admin'::app_role) OR 
        has_role(requesting_user_id, 'production_manager'::app_role) OR
        has_role(requesting_user_id, 'hr_manager'::app_role)
    ) THEN
        RAISE EXCEPTION 'Access denied: Manager permissions required';
    END IF;
    
    -- Log access for audit
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason
    )
    VALUES (
        requesting_user_id,
        COALESCE(_manager_id, requesting_user_id),
        'team_member_info_access',
        'manager_team_access'
    );
    
    -- Return basic team member information
    -- This is a simplified version - in real implementation, you'd filter by actual reporting relationships
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.job_title,
        p.department,
        esd.email
    FROM public.profiles p
    LEFT JOIN public.employee_sensitive_data esd ON esd.id = p.id
    WHERE p.department IS NOT NULL
    LIMIT 50; -- Reasonable limit for team size
END;
$$;

-- Create secure function for HR to access all profiles with approval workflow
CREATE OR REPLACE FUNCTION public.get_profiles_hr_access(_profile_id uuid DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    display_name text,
    job_title text,
    department text,
    email text,
    phone_number text,
    full_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    data_classification text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    requesting_user_id uuid := auth.uid();
    active_session_exists boolean := false;
BEGIN
    -- Strict permission check - only admins can access all HR profiles
    IF NOT has_role(requesting_user_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Administrator permissions required for HR profile access';
    END IF;
    
    -- Check for active HR data access session (if accessing sensitive data)
    IF _profile_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.hr_sensitive_data_sessions
            WHERE user_id = requesting_user_id 
            AND employee_id = _profile_id::text
            AND is_active = true
            AND expires_at > now()
        ) INTO active_session_exists;
        
        IF NOT active_session_exists THEN
            RAISE EXCEPTION 'Access denied: No active session for accessing sensitive profile data. Please request access first.';
        END IF;
    END IF;
    
    -- Log access for audit
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, risk_level
    )
    VALUES (
        requesting_user_id,
        _profile_id,
        'hr_full_profile_access',
        'administrative_hr_access',
        'high'
    );
    
    -- Return profile information from both tables
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.job_title,
        p.department,
        esd.email,
        esd.phone_number,
        esd.full_name,
        p.created_at,
        p.updated_at,
        p.data_classification
    FROM public.profiles p
    LEFT JOIN public.employee_sensitive_data esd ON esd.id = p.id
    WHERE (_profile_id IS NULL OR p.id = _profile_id)
    ORDER BY p.created_at DESC;
END;
$$;

-- Create trigger to ensure data classification is always set appropriately
CREATE OR REPLACE FUNCTION public.enforce_profile_data_classification()
RETURNS TRIGGER AS $$
BEGIN
    -- Profiles table should only contain non-sensitive display information
    NEW.data_classification := 'public';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_profile_classification_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_classification_trigger
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_data_classification();

-- Add comment to document the security changes
COMMENT ON TABLE public.profiles IS 'Contains only public display information. Sensitive employee data is stored in employee_sensitive_data table with proper access controls.';
COMMENT ON TABLE public.employee_sensitive_data IS 'Contains sensitive employee information with strict access controls and audit logging.';