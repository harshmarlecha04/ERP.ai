DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower('gotham.rajavelu@gmail.com');

  UPDATE public.customer_invitations
     SET accepted_at = NULL,
         expires_at = GREATEST(expires_at, now() + interval '7 days')
   WHERE lower(email) = lower('gotham.rajavelu@gmail.com');

  IF uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = uid;
    DELETE FROM public.customer_users WHERE user_id = uid;
    DELETE FROM public.profiles WHERE id = uid;
    DELETE FROM auth.users WHERE id = uid;
  END IF;
END $$;