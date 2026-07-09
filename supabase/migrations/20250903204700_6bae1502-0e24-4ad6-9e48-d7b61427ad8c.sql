-- Give full admin access to sales@pharmvista.com user
DO $$
DECLARE
    target_user_id uuid;
    admin_user_id uuid;
BEGIN
    -- Find the user ID for sales@pharmvista.com
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'sales@pharmvista.com';
    
    -- Get an admin user ID to use as the granter (use the first admin we find)
    SELECT user_id INTO admin_user_id 
    FROM public.user_roles 
    WHERE role = 'admin'::app_role 
    LIMIT 1;
    
    -- If no admin exists, use the target user as the granter (self-grant)
    IF admin_user_id IS NULL THEN
        admin_user_id := target_user_id;
    END IF;
    
    IF target_user_id IS NOT NULL THEN
        -- Delete any existing roles for this user to avoid conflicts
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        
        -- Insert admin role for the target user
        INSERT INTO public.user_roles (
            user_id, 
            role, 
            granted_by, 
            granted_at
        ) VALUES (
            target_user_id,
            'admin'::app_role,
            admin_user_id,
            now()
        );
        
        RAISE NOTICE 'Successfully granted admin access to sales@pharmvista.com (user_id: %)', target_user_id;
    ELSE
        RAISE NOTICE 'User sales@pharmvista.com not found in auth.users table. They may need to sign up first.';
    END IF;
END $$;