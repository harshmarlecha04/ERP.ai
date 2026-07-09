-- Create function to update user roles (admin only)
CREATE OR REPLACE FUNCTION public.update_user_role(_user_email text, _role app_role, _grant boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    target_user_id uuid;
    result jsonb;
BEGIN
    -- Only admins can update user roles
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: Admin privileges required');
    END IF;
    
    -- Find user by email
    SELECT au.id INTO target_user_id
    FROM auth.users au
    WHERE au.email = _user_email;
    
    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    IF _grant THEN
        -- Grant role (insert if not exists)
        INSERT INTO public.user_roles (user_id, role, granted_by)
        VALUES (target_user_id, _role, auth.uid())
        ON CONFLICT (user_id, role) DO NOTHING;
        
        result := jsonb_build_object(
            'success', true, 
            'message', format('Role %s granted to %s', _role, _user_email),
            'action', 'granted'
        );
    ELSE
        -- Revoke role
        DELETE FROM public.user_roles 
        WHERE user_id = target_user_id AND role = _role;
        
        result := jsonb_build_object(
            'success', true, 
            'message', format('Role %s revoked from %s', _role, _user_email),
            'action', 'revoked'
        );
    END IF;
    
    RETURN result;
END;
$function$;

-- Create function to get user by email for admin use
CREATE OR REPLACE FUNCTION public.get_user_by_email_admin(_email text)
RETURNS TABLE(
    user_id uuid,
    email text,
    display_name text,
    created_at timestamptz,
    roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Only admins can look up users by email
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        au.id as user_id,
        au.email,
        COALESCE(p.display_name, au.email) as display_name,
        au.created_at,
        ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL) as roles
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE au.email = _email
    GROUP BY au.id, au.email, p.display_name, au.created_at;
END;
$function$;