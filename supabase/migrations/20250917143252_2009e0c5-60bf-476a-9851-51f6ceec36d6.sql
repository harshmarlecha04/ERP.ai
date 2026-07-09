-- Assign production_manager role to current user to allow formula access
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
SELECT auth.uid(), 'production_manager', auth.uid(), now()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;