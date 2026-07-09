INSERT INTO public.user_roles (user_id, role)
VALUES ('a8a2da39-c15e-4998-b13c-8e6258ea91ea', 'customer')
ON CONFLICT (user_id, role) DO NOTHING;