-- Directly assign admin role to the current user
-- User: mfg@pharmvista.com (a8a2da39-c15e-4998-b13c-8e6258ea91ea)

INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
VALUES (
  'a8a2da39-c15e-4998-b13c-8e6258ea91ea'::uuid,
  'admin'::app_role,
  'a8a2da39-c15e-4998-b13c-8e6258ea91ea'::uuid,
  now()
)
ON CONFLICT (user_id, role) DO NOTHING;