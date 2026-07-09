
-- 1. Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

-- 2. customer_users link table
CREATE TABLE IF NOT EXISTS public.customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  role_at_company text NOT NULL DEFAULT 'member' CHECK (role_at_company IN ('owner','member')),
  is_primary boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_users_user ON public.customer_users(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_customer ON public.customer_users(customer_id);
DO $rls$ BEGIN ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_my_customer_id' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_my_customer_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT customer_id FROM public.customer_users
  WHERE user_id = auth.uid()
  ORDER BY is_primary DESC, accepted_at DESC NULLS LAST
  LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.customer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  role_at_company text NOT NULL DEFAULT 'member' CHECK (role_at_company IN ('owner','member')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_customer_invitations_email ON public.customer_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_customer_invitations_token ON public.customer_invitations(token);
DO $rls$ BEGIN ALTER TABLE public.customer_invitations ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

CREATE TABLE IF NOT EXISTS public.customer_onboarding (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  current_step text NOT NULL DEFAULT 'company_info'
    CHECK (current_step IN ('company_info','contacts','compliance_docs','payment_terms','signed_agreement','submitted','complete')),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','pending_review','approved','rejected')),
  company_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  w9_path text,
  coi_path text,
  signed_agreement_path text,
  signature_name text,
  signature_signed_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $rls$ BEGIN ALTER TABLE public.customer_onboarding ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

CREATE TABLE IF NOT EXISTS public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('coa','formula_pdf','invoice','agreement','other')),
  title text NOT NULL,
  storage_path text NOT NULL,
  formula_id uuid,
  order_id uuid REFERENCES public.order_headers(id) ON DELETE SET NULL,
  visible_to_customer boolean NOT NULL DEFAULT true,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_documents_customer ON public.customer_documents(customer_id);
DO $rls$ BEGIN ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DROP TRIGGER IF EXISTS trg_customer_onboarding_updated ON public.customer_onboarding;
CREATE TRIGGER trg_customer_onboarding_updated
  BEFORE UPDATE ON public.customer_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-portal', 'customer-portal', false)
ON CONFLICT (id) DO NOTHING;

-- ============ RLS POLICIES ============

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users see their own customer links" ON public.customer_users; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users see their own customer links"
  ON public.customer_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins manage customer links" ON public.customer_users; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins manage customer links"
  ON public.customer_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins manage invitations" ON public.customer_invitations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins manage invitations"
  ON public.customer_invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own onboarding" ON public.customer_onboarding; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own onboarding"
  ON public.customer_onboarding FOR SELECT TO authenticated
  USING (customer_id = public.get_my_customer_id() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers update own onboarding before approval" ON public.customer_onboarding; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers update own onboarding before approval"
  ON public.customer_onboarding FOR UPDATE TO authenticated
  USING ((customer_id = public.get_my_customer_id() AND approved_at IS NULL) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK ((customer_id = public.get_my_customer_id() AND approved_at IS NULL) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Insert onboarding" ON public.customer_onboarding; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Insert onboarding"
  ON public.customer_onboarding FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR customer_id = public.get_my_customer_id()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own visible documents" ON public.customer_documents; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own visible documents"
  ON public.customer_documents FOR SELECT TO authenticated
  USING (
    (customer_id = public.get_my_customer_id() AND visible_to_customer = true)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff manage customer documents" ON public.customer_documents; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff manage customer documents"
  ON public.customer_documents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'production_manager')
    OR public.has_role(auth.uid(), 'quality_manager')
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Customer access on existing tables (additive policies)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own order headers" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own order headers"
  ON public.order_headers FOR SELECT TO authenticated
  USING (customer_id = public.get_my_customer_id()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own order line items" ON public.order_line_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own order line items"
  ON public.order_line_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_headers oh
    WHERE oh.id = order_line_items.order_id
      AND oh.customer_id = public.get_my_customer_id()
  )); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own shipments" ON public.order_shipments; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own shipments"
  ON public.order_shipments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_headers oh
    WHERE oh.id = order_shipments.order_id
      AND oh.customer_id = public.get_my_customer_id()
  )); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own shipment lines" ON public.order_shipment_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own shipment lines"
  ON public.order_shipment_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_shipments os
    JOIN public.order_headers oh ON oh.id = os.order_id
    WHERE os.id = order_shipment_lines.shipment_id
      AND oh.customer_id = public.get_my_customer_id()
  )); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers view own delivery milestones" ON public.order_delivery_milestones; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers view own delivery milestones"
  ON public.order_delivery_milestones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_headers oh
    WHERE oh.id = order_delivery_milestones.order_id
      AND oh.customer_id = public.get_my_customer_id()
  )); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers read their own messages" ON public.direct_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers read their own messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers send messages as themselves" ON public.direct_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers send messages as themselves"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Invitation acceptance RPC
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='accept_customer_invitation' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.accept_customer_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.customer_invitations%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM public.customer_invitations WHERE token = _token;
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

-- Storage policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers read their own portal files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers read their own portal files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'customer-portal'
    AND (
      (split_part(name, '/', 1))::uuid = public.get_my_customer_id()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'production_manager')
      OR public.has_role(auth.uid(), 'quality_manager')
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers upload to their folder" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers upload to their folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'customer-portal'
    AND (
      (split_part(name, '/', 1))::uuid = public.get_my_customer_id()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'production_manager')
      OR public.has_role(auth.uid(), 'quality_manager')
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff manage portal files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff manage portal files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'customer-portal'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'production_manager')
      OR public.has_role(auth.uid(), 'quality_manager')
    )
  )
  WITH CHECK (
    bucket_id = 'customer-portal'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'production_manager')
      OR public.has_role(auth.uid(), 'quality_manager')
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
