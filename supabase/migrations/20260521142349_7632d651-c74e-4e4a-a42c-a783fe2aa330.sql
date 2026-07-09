DO $seed$ BEGIN INSERT INTO public.customer_users (user_id, customer_id, role_at_company, is_primary, accepted_at)
VALUES ('a8a2da39-c15e-4998-b13c-8e6258ea91ea', '7ec83b9f-f9f5-47b6-9d99-a6950d330e1a', 'owner', true, now())
ON CONFLICT DO NOTHING; EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;
DO $seed$ BEGIN INSERT INTO public.customer_onboarding (customer_id, status)
VALUES ('7ec83b9f-f9f5-47b6-9d99-a6950d330e1a', 'approved')
ON CONFLICT (customer_id) DO UPDATE SET status='approved'; EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;