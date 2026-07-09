UPDATE public.customer_invitations
   SET email = 'gotham.rajavelu+test1@gmail.com',
       accepted_at = NULL,
       accepted_by = NULL,
       expires_at = now() + interval '7 days'
 WHERE lower(email) = lower('gotham.rajavelu@gmail.com');