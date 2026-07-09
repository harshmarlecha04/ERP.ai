-- Create secure function to get all users with their profiles and roles (admin only)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_all_users_admin' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE(
    id uuid,
    email text,
    display_name text,
    job_title text,
    department text,
    created_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow admin users to access this function
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Administrator privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        au.id,
        au.email::text,
        COALESCE(p.display_name, au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'full_name', au.email::text) as display_name,
        COALESCE(p.job_title, au.raw_user_meta_data->>'job_title', 'User') as job_title,
        COALESCE(p.department, 'Unassigned') as department,
        au.created_at,
        au.last_sign_in_at,
        COALESCE(
            ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
            ARRAY['user']::text[]
        ) as roles
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE au.deleted_at IS NULL
    GROUP BY au.id, au.email, p.display_name, p.job_title, p.department, au.created_at, au.last_sign_in_at, au.raw_user_meta_data
    ORDER BY au.created_at DESC;
END;
$$;