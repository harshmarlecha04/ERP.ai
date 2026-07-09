DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_email_domain' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email ~* '^[A-Za-z0-9._%+-]+@pharmvista\.com$' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Access denied: email % is not allowed to register', NEW.email;
END;
$function$;