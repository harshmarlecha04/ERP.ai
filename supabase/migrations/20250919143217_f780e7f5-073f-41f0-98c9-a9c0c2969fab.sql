-- Assign admin role to the most recent user (likely the current user)
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
SELECT 
    au.id,
    'admin'::app_role,
    au.id,
    now()
FROM auth.users au 
ORDER BY au.created_at DESC 
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;