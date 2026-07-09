-- Grant admin role to your specific user ID
INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
VALUES (
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea'::uuid,
    'admin'::app_role,
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea'::uuid,
    now()
)
ON CONFLICT (user_id, role) DO NOTHING;