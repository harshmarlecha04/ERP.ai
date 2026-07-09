-- Also assign admin role to all users as backup (for testing)
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
SELECT u.id, 'admin', u.id, now()
FROM auth.users u
WHERE u.id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;