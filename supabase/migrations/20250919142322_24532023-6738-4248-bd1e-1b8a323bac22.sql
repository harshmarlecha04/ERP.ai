-- Grant admin role to the current user to enable formula management
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
SELECT 
    au.id,
    'admin'::app_role,
    au.id,  -- Self-granted for initial setup
    now()
FROM auth.users au
WHERE au.id = auth.uid()
ON CONFLICT (user_id, role) DO NOTHING;