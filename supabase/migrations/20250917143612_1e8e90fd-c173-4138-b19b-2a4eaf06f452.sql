-- Assign production_manager role to the first user (for testing)
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
SELECT u.id, 'production_manager', u.id, now()
FROM auth.users u
WHERE u.id IS NOT NULL
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;