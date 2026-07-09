-- Simple security fix: Clean up profile table policies for data separation
-- Remove sensitive fields from profiles table (keeping only public display data)

-- Only remove sensitive columns if they exist
DO $$
BEGIN
    -- Remove email column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'email' AND table_schema = 'public') THEN
        ALTER TABLE public.profiles DROP COLUMN email;
    END IF;
    
    -- Remove phone_number column if it exists  
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'phone_number' AND table_schema = 'public') THEN
        ALTER TABLE public.profiles DROP COLUMN phone_number;
    END IF;
    
    -- Remove full_name column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'full_name' AND table_schema = 'public') THEN
        ALTER TABLE public.profiles DROP COLUMN full_name;
    END IF;
END$$;

-- Update data classification for all profiles to reflect they only contain public data
UPDATE public.profiles SET data_classification = 'public' WHERE data_classification != 'public';

-- Add comments to document the security separation
COMMENT ON TABLE public.profiles IS 'Contains only public display information (display_name, job_title, department). Sensitive employee PII is stored in employee_sensitive_data table with strict access controls.';

-- Ensure the existing security functions are properly documented
COMMENT ON FUNCTION public.get_profiles_hr_access(uuid) IS 'Secure function for HR access to employee data. Requires admin permissions and active HR session for sensitive data access. All access is logged for audit.';
COMMENT ON FUNCTION public.get_user_display_info(uuid[]) IS 'Secure function for accessing basic user display information. All access is logged for audit purposes.';
COMMENT ON FUNCTION public.get_team_member_basic_info(uuid) IS 'Secure function for managers to access basic team member information. Requires manager role permissions.';