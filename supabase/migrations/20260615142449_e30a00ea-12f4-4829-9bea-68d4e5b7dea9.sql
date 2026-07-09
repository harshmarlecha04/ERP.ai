DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='enforce_employee_email_domain' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.enforce_employee_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow @pharmvista.com freely (employee accounts)
  IF lower(NEW.email) LIKE '%@pharmvista.com' THEN
    RETURN NEW;
  END IF;

  -- Allow customer accounts created via active invitation
  IF EXISTS (
    SELECT 1 FROM public.customer_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  ) THEN
    RETURN NEW;
  END IF;

  -- Allow explicit customer signup metadata (set by invite-accept edge function/admin)
  IF coalesce(NEW.raw_user_meta_data->>'account_type','') = 'customer' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only @pharmvista.com emails may create employee accounts. Customer accounts require an invitation.'
    USING ERRCODE = '22023';
END;
$$;

DROP TRIGGER IF EXISTS enforce_employee_email_domain ON auth.users;
DROP TRIGGER IF EXISTS enforce_employee_email_domain ON auth.users;
CREATE TRIGGER enforce_employee_email_domain
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_email_domain();