-- Grant admin role to current authenticated user
DO $$ 
DECLARE
    current_user_id uuid := auth.uid();
BEGIN
    IF current_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
        VALUES (current_user_id, 'admin'::app_role, current_user_id, now())
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'Admin role granted to user: %', current_user_id;
    ELSE
        RAISE NOTICE 'No authenticated user found';
    END IF;
END $$;