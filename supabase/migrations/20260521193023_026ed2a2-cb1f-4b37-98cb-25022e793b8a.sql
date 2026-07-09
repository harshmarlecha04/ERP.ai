DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'gotham.rajavelu@gmail.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  UPDATE public.customer_invitations
     SET accepted_at = NULL,
         accepted_by = NULL,
         expires_at = now() + interval '7 days'
   WHERE lower(email) = lower(v_email)
      OR accepted_by = v_user_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    DELETE FROM public.customer_users WHERE user_id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END $$;