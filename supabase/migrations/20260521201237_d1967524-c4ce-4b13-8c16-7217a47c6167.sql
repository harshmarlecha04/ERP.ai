
CREATE OR REPLACE FUNCTION public.get_customer_by_signup_code(_short_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('company_name', company_name, 'company_code', company_code)
  FROM public.customers
  WHERE signup_short_code = _short_code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_by_signup_code(text) TO anon, authenticated;
