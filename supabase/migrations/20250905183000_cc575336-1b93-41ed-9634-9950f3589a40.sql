-- Grant admin role to all existing users who don't currently have it
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
SELECT 
    u.id as user_id,
    'admin'::app_role as role,
    u.id as granted_by,
    now() as granted_at
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id AND ur.role = 'admin'
WHERE ur.user_id IS NULL;

-- Replace the existing function to assign admin to ALL users (not just the first)
CREATE OR REPLACE FUNCTION public.assign_admin_to_all_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Assign admin role to every new user
    INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
    VALUES (NEW.id, 'admin', NEW.id, now())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role assigned to user: %', NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Update the trigger to use the new function and apply to all users
DROP TRIGGER IF EXISTS assign_first_admin_trigger ON auth.users;
CREATE TRIGGER assign_admin_to_all_users_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_admin_to_all_users();