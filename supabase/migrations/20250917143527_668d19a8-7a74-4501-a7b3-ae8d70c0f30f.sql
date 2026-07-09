-- Get current authenticated user and assign production_manager role
DO $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Get the current authenticated user
    SELECT auth.uid() INTO current_user_id;
    
    -- If we have a user, assign the production_manager role
    IF current_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
        VALUES (current_user_id, 'production_manager', current_user_id, now())
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'Assigned production_manager role to user: %', current_user_id;
    ELSE
        RAISE NOTICE 'No authenticated user found';
    END IF;
END
$$;