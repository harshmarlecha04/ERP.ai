-- ERP.ai productization: open signup, first-user-admin, company onboarding
-- 1. Remove Pharmvista-only email domain restrictions
DROP TRIGGER IF EXISTS enforce_email_domain ON auth.users;
DROP TRIGGER IF EXISTS enforce_employee_email_domain ON auth.users;

-- 2. Remove the everyone-becomes-admin trigger (dangerous default);
--    keep on_auth_user_created_assign_admin (first user only)
DROP TRIGGER IF EXISTS assign_admin_to_all_users_trigger ON auth.users;

-- The profiles table has its own domain gate; remove it too
DROP TRIGGER IF EXISTS validate_email_domain_trigger ON public.profiles;

-- 3. Later signups get a safe default role so they can use the app
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
    VALUES (NEW.id, 'inventory_user', NEW.id, now())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS zz_assign_default_role ON auth.users;
CREATE TRIGGER zz_assign_default_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- 4. Company settings (one row per deployment)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name text NOT NULL,
  industry text,
  address text,
  phone text,
  logo_url text,
  setup_complete boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read company settings" ON public.company_settings;
CREATE POLICY "Authenticated can read company settings" ON public.company_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage company settings" ON public.company_settings;
CREATE POLICY "Admins manage company settings" ON public.company_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Restore the 4-arg audit logger that profile updates call
--    (audit must never break signup, so it swallows its own failures)
CREATE OR REPLACE FUNCTION public.log_employee_data_access(
  _employee_id uuid, _accessed_by uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.employee_sensitive_data_audit
    (employee_id, accessed_by, access_type, access_reason, risk_level, data_fields_accessed)
  VALUES
    (_employee_id, COALESCE(_accessed_by, _employee_id), _access_type, 'system', 'low',
     CASE WHEN _details ? 'updated_fields'
          THEN (SELECT array_agg(k) FROM jsonb_object_keys(_details->'updated_fields') k)
          ELSE NULL END);
EXCEPTION WHEN OTHERS THEN
  NULL; -- never let auditing break the actual operation
END;
$fn$;
