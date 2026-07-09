
ALTER TABLE public.customers
  ALTER COLUMN signup_short_code SET DEFAULT public.gen_customer_signup_code();
