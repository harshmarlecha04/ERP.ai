-- Critical Security Fix: Initialize Admin User
-- This migration safely assigns admin role to the first user if no admins exist

DO $$
DECLARE
    first_user_id uuid;
BEGIN
    -- Check if any admin exists
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        -- Get the first user (by creation date)
        SELECT id INTO first_user_id 
        FROM auth.users 
        ORDER BY created_at ASC 
        LIMIT 1;
        
        -- If a user exists, make them admin
        IF first_user_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
            VALUES (first_user_id, 'admin', first_user_id, now())
            ON CONFLICT (user_id, role) DO NOTHING;
            
            RAISE NOTICE 'Admin role assigned to first user: %', first_user_id;
        ELSE
            RAISE NOTICE 'No users found - admin will be assigned when first user registers';
        END IF;
    ELSE
        RAISE NOTICE 'Admin user already exists - no changes made';
    END IF;
END $$;

-- Create a trigger to automatically assign admin role to the first user on signup
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='assign_first_user_as_admin' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign admin if no admin exists yet
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
        VALUES (NEW.id, 'admin', NEW.id, now());
        
        RAISE NOTICE 'First user assigned admin role: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after user creation
DROP TRIGGER IF EXISTS assign_first_admin_trigger ON auth.users;
DROP TRIGGER IF EXISTS assign_first_admin_trigger ON auth.users;
CREATE TRIGGER assign_first_admin_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_first_user_as_admin();