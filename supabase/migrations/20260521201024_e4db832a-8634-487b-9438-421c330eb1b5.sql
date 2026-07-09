
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='gen_customer_signup_code' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.gen_customer_signup_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    code := substr(code, 1, 4) || '-' || substr(code, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE signup_short_code = code);
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique customer signup code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS signup_short_code text;

-- Backfill: bypass user triggers (audit logger requires auth.uid() which is null in migration context)
DO $srr$ BEGIN EXECUTE 'SET LOCAL session_replication_role = replica'; EXCEPTION WHEN insufficient_privilege THEN NULL; END $srr$;
UPDATE public.customers
SET signup_short_code = public.gen_customer_signup_code()
WHERE signup_short_code IS NULL;
DO $srr$ BEGIN EXECUTE 'SET LOCAL session_replication_role = origin'; EXCEPTION WHEN insufficient_privilege THEN NULL; END $srr$;

ALTER TABLE public.customers
  ALTER COLUMN signup_short_code SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.customers
    ADD CONSTRAINT customers_signup_short_code_key UNIQUE (signup_short_code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_customers_signup_short_code
  ON public.customers(signup_short_code);

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='set_customer_signup_code' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.set_customer_signup_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.signup_short_code IS NULL THEN
    NEW.signup_short_code := public.gen_customer_signup_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_signup_code ON public.customers;
DROP TRIGGER IF EXISTS trg_customer_signup_code ON public.customers;
CREATE TRIGGER trg_customer_signup_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_signup_code();

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='claim_customer_signup' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.claim_customer_signup(_short_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_existing uuid;
  v_has_owner boolean;
  v_role text;
  v_is_primary boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE signup_short_code = _short_code;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT id INTO v_existing
  FROM public.customer_users
  WHERE user_id = auth.uid() AND customer_id = v_customer_id;

  IF v_existing IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'customer'::app_role)
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'customer_id', v_customer_id, 'already_linked', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customer_users
    WHERE customer_id = v_customer_id AND role_at_company = 'owner'
  ) INTO v_has_owner;

  IF v_has_owner THEN
    v_role := 'member';
    v_is_primary := false;
  ELSE
    v_role := 'owner';
    v_is_primary := true;
  END IF;

  INSERT INTO public.customer_users (user_id, customer_id, role_at_company, is_primary, accepted_at)
  VALUES (auth.uid(), v_customer_id, v_role, v_is_primary, now());

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'customer'::app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.customer_onboarding (customer_id) VALUES (v_customer_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'customer_id', v_customer_id, 'role', v_role);
END;
$$;
