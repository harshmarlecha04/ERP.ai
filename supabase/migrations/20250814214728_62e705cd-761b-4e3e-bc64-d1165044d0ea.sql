-- Drop the problematic secure_profiles view since it can't have RLS policies directly
DROP VIEW IF EXISTS public.secure_profiles;

-- Instead, let's enhance the existing profiles table security
-- Check if profiles table already has adequate RLS policies (it should based on our previous work)

-- Add a function that returns sanitized profile data for public viewing
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_sanitized_profile_data' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_sanitized_profile_data(_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    profile_data jsonb;
    viewer_has_access boolean;
BEGIN
    -- Check if the viewer has access to view this profile
    viewer_has_access := public.can_access_profile_secure(auth.uid(), _profile_id, 'view');
    
    -- If no access, return minimal sanitized data
    IF NOT viewer_has_access THEN
        SELECT jsonb_build_object(
            'id', id,
            'display_name', 'Employee',
            'job_title', 'Team Member'
        ) INTO profile_data
        FROM public.profiles 
        WHERE id = _profile_id;
        
        RETURN COALESCE(profile_data, '{}'::jsonb);
    END IF;
    
    -- If authorized, return full data based on classification
    SELECT jsonb_build_object(
        'id', id,
        'display_name', display_name,
        'job_title', CASE 
            WHEN data_classification = 'confidential' AND NOT public.has_role(auth.uid(), 'admin'::app_role)
            THEN 'Confidential Position'
            ELSE job_title
        END,
        'email', CASE 
            WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role)
            THEN email
            ELSE NULL
        END,
        'full_name', CASE 
            WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role)
            THEN full_name
            ELSE NULL
        END
    ) INTO profile_data
    FROM public.profiles 
    WHERE id = _profile_id;
    
    RETURN COALESCE(profile_data, '{}'::jsonb);
END;
$$;