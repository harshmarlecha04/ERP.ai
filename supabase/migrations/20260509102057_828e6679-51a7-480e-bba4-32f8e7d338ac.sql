
-- 1. Generator function (unambiguous chars only)
CREATE OR REPLACE FUNCTION public.gen_invite_short_code()
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
    -- Format as XXXX-XXXX
    code := substr(code, 1, 4) || '-' || substr(code, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customer_invitations WHERE short_code = code);
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique invite short code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- 2. Add column (nullable first for backfill)
ALTER TABLE public.customer_invitations
  ADD COLUMN IF NOT EXISTS short_code text;

-- 3. Backfill existing rows
UPDATE public.customer_invitations
SET short_code = public.gen_invite_short_code()
WHERE short_code IS NULL;

-- 4. Add unique constraint
ALTER TABLE public.customer_invitations
  ADD CONSTRAINT customer_invitations_short_code_key UNIQUE (short_code);

CREATE INDEX IF NOT EXISTS idx_customer_invitations_short_code
  ON public.customer_invitations(short_code);

-- 5. Trigger for new rows
CREATE OR REPLACE FUNCTION public.set_invitation_short_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.gen_invite_short_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitation_short_code ON public.customer_invitations;
CREATE TRIGGER trg_invitation_short_code
  BEFORE INSERT ON public.customer_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_invitation_short_code();

-- 6. Update accept RPC to accept short code OR long token
CREATE OR REPLACE FUNCTION public.accept_customer_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.customer_invitations%ROWTYPE;
  v_email text;
  v_normalized text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Normalize short code: uppercase, strip dashes/spaces, then re-insert dash
  v_normalized := upper(regexp_replace(coalesce(_token, ''), '[\s\-]', '', 'g'));

  -- Match either long token (as-is) or short_code (normalized with dash)
  SELECT * INTO v_inv
  FROM public.customer_invitations
  WHERE token = _token
     OR short_code = (
       CASE WHEN length(v_normalized) = 8
         THEN substr(v_normalized, 1, 4) || '-' || substr(v_normalized, 5, 4)
         ELSE v_normalized
       END
     )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_accepted');
  END IF;
  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.customer_users (user_id, customer_id, role_at_company, invited_by, invited_at, accepted_at)
  VALUES (auth.uid(), v_inv.customer_id, v_inv.role_at_company, v_inv.invited_by, v_inv.invited_at, now())
  ON CONFLICT (user_id, customer_id) DO UPDATE SET accepted_at = EXCLUDED.accepted_at;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'customer'::app_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.customer_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  INSERT INTO public.customer_onboarding (customer_id) VALUES (v_inv.customer_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'customer_id', v_inv.customer_id);
END;
$$;
