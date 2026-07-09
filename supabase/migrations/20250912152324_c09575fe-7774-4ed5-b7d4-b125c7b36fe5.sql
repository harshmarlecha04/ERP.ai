-- Grant admin role to qa6@pharmvista.com
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT 
    au.id,
    'admin'::app_role,
    au.id  -- Self-granted for bootstrap
FROM auth.users au
WHERE au.email = 'qa6@pharmvista.com'
ON CONFLICT (user_id, role) DO NOTHING;