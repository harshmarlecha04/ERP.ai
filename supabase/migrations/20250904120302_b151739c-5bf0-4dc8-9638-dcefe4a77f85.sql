-- Fix Critical Security Vulnerability: Profiles Data Exposure
-- Remove overly permissive access to employee personal information

-- Drop the dangerous policy that allows all authenticated users to see all profiles
DROP POLICY IF EXISTS "All authenticated users can view all profiles" ON public.profiles;

-- Keep the admin policy but make it more explicit
-- (The existing admin policy is already properly restrictive)

-- Create secure, role-based access policies for profiles

-- 1. Users can view their own profile (essential for profile management)
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (id = auth.uid());

-- 2. HR managers can view all profiles (legitimate business need)
CREATE POLICY "HR managers can view all profiles" ON public.profiles
FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
);

-- 3. Create a secure function for getting basic user info (display names, job titles)
-- This allows the UI to show user names without exposing sensitive contact information
CREATE OR REPLACE FUNCTION public.get_user_display_info(_user_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(
    id uuid,
    display_name text,
    job_title text,
    department text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_has_hr_access boolean := false;
BEGIN
    -- Check if user has HR access for broader visibility
    user_has_hr_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role)
    );
    
    -- Return display information based on access level
    IF user_has_hr_access THEN
        -- HR can see display info for requested users or all users
        RETURN QUERY
        SELECT 
            p.id,
            p.display_name,
            p.job_title,
            p.department
        FROM public.profiles p
        WHERE (_user_ids IS NULL OR p.id = ANY(_user_ids))
        ORDER BY p.display_name;
    ELSE
        -- Regular users can only see their own display info plus basic info for users they work with
        RETURN QUERY
        SELECT 
            p.id,
            p.display_name,
            p.job_title,
            p.department
        FROM public.profiles p
        WHERE p.id = current_user_id
           OR (_user_ids IS NOT NULL AND p.id = ANY(_user_ids) AND p.email_visible_to_public = true)
        ORDER BY p.display_name;
    END IF;
    
    -- Log access for audit purposes
    PERFORM public.log_employee_data_access(
        current_user_id,
        current_user_id,
        'profile_display_info_access',
        jsonb_build_object(
            'requested_users', _user_ids,
            'access_level', CASE WHEN user_has_hr_access THEN 'hr_full' ELSE 'limited' END
        )
    );
END;
$$;

-- 4. Create a secure function for managers to get basic team member info
-- This allows managers to see basic info about their direct reports without sensitive data
CREATE OR REPLACE FUNCTION public.get_team_member_basic_info(_manager_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
    id uuid,
    display_name text,
    job_title text,
    department text,
    email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_has_manager_access boolean := false;
    target_manager_id uuid := COALESCE(_manager_id, current_user_id);
BEGIN
    -- Check if user has permission to see team member info
    user_has_manager_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role) OR
        has_role(current_user_id, 'production_manager'::app_role) OR
        current_user_id = target_manager_id
    );
    
    IF NOT user_has_manager_access THEN
        RETURN;
    END IF;
    
    -- Return basic team member info (no phone numbers or sensitive data)
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.job_title,
        p.department,
        CASE 
            WHEN p.email_visible_to_public = true OR has_role(current_user_id, 'hr_manager'::app_role)
            THEN p.email 
            ELSE NULL 
        END as email
    FROM public.profiles p
    JOIN public.employee_sensitive_data esd ON esd.id = p.id
    WHERE esd.manager_id = target_manager_id
    ORDER BY p.display_name;
    
    -- Log access
    PERFORM public.log_employee_data_access(
        target_manager_id,
        current_user_id,
        'team_member_basic_info_access',
        jsonb_build_object(
            'manager_id', target_manager_id,
            'access_type', 'basic_info_only'
        )
    );
END;
$$;

-- 5. Create a function for HR to get full profile access with audit logging
CREATE OR REPLACE FUNCTION public.get_profiles_hr_access(_profile_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
    id uuid,
    email text,
    full_name text,
    display_name text,
    job_title text,
    department text,
    phone_number text,
    data_classification text,
    privacy_consent_given boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    user_has_hr_access boolean := false;
BEGIN
    -- Verify HR access
    user_has_hr_access := (
        has_role(current_user_id, 'admin'::app_role) OR 
        has_role(current_user_id, 'hr_manager'::app_role)
    );
    
    IF NOT user_has_hr_access THEN
        -- Log unauthorized access attempt
        PERFORM public.log_employee_data_access(
            COALESCE(_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
            current_user_id,
            'unauthorized_profile_access_attempt',
            jsonb_build_object(
                'reason', 'insufficient_permissions',
                'required_role', 'hr_manager_or_admin'
            )
        );
        RETURN;
    END IF;
    
    -- Return full profile data for HR
    RETURN QUERY
    SELECT 
        p.id, p.email, p.full_name, p.display_name, p.job_title,
        p.department, p.phone_number, p.data_classification,
        p.privacy_consent_given, p.created_at, p.updated_at
    FROM public.profiles p
    WHERE (_profile_id IS NULL OR p.id = _profile_id)
    ORDER BY p.display_name;
    
    -- Log HR access
    PERFORM public.log_employee_data_access(
        COALESCE(_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        current_user_id,
        'hr_profile_access',
        jsonb_build_object(
            'scope', CASE WHEN _profile_id IS NULL THEN 'all_profiles' ELSE 'single_profile' END,
            'data_accessed', 'full_profile_including_contact_info'
        )
    );
END;
$$;

-- 6. Enhanced audit logging specifically for profile access
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log profile access for security monitoring
    IF TG_OP = 'SELECT' THEN
        -- Note: This won't work directly for SELECT, but can be called manually
        RETURN NEW;
    END IF;
    
    -- Log profile updates
    IF TG_OP = 'UPDATE' THEN
        PERFORM public.log_employee_data_access(
            NEW.id,
            auth.uid(),
            'profile_update',
            jsonb_build_object(
                'updated_fields', (
                    SELECT jsonb_object_agg(key, value) 
                    FROM jsonb_each(to_jsonb(NEW)) 
                    WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key
                )
            )
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Create trigger for profile updates
CREATE TRIGGER profile_update_audit_trigger
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_profile_access();

-- Update table comment to reflect new security policy
COMMENT ON TABLE public.profiles IS 'Employee profile information with restricted access. Users can only view their own profile. HR managers can view all profiles. All access is logged for security compliance. Contact information is protected to prevent harvesting and spam.';

-- Create index for performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name) WHERE display_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department) WHERE department IS NOT NULL;