-- agent_events table (created outside the migration chain originally; schema from generated types)
CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  triggered_by text NOT NULL,
  triggered_by_user_id uuid,
  parent_event_id uuid,
  payload jsonb,
  result jsonb,
  anthropic_batch_id text,
  requires_approval boolean DEFAULT false,
  approved_at timestamptz,
  approved_by uuid,
  rejected_reason text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

-- ingested_emails table (created outside the migration chain originally; schema from generated types)
CREATE TABLE IF NOT EXISTS public.ingested_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_message_id text NOT NULL UNIQUE,
  agent_event_id uuid,
  from_email text NOT NULL,
  from_name text,
  subject text,
  body_preview text,
  has_attachments boolean DEFAULT false,
  attachment_filenames text[],
  attachment_storage_paths text[],
  po_detected boolean DEFAULT false,
  processing_status text DEFAULT 'pending',
  received_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ingested_emails ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 1. inquiry_messages: remove anon access
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "Allow viewing recently created messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 2. inquiry_order_details: remove anon access
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "Allow viewing recently created order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 3. user_roles: restrict SELECT
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view user roles" ON public.user_roles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 4. formula_access_requests: tighten UPDATE/DELETE/SELECT
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can update formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can delete formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "View formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "View formula access requests"
  ON public.formula_access_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authorized roles can update formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authorized roles can update formula access requests"
  ON public.formula_access_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rd_manager'::app_role))
    AND approved_by IS DISTINCT FROM user_id
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authorized roles can delete formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authorized roles can delete formula access requests"
  ON public.formula_access_requests FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    OR user_id = auth.uid()
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 5. user_activity_audit: admins only
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view activity audit" ON public.user_activity_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view activity audit" ON public.user_activity_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view activity audit"
  ON public.user_activity_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 6. formula_access_audit: admins only
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view formula access audit" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view formula access audit" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view formula access audit"
  ON public.formula_access_audit FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 7. ingested_emails: restrict to admin/production_manager
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "ingested_emails_read" ON public.ingested_emails; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authorized staff can read ingested emails" ON public.ingested_emails; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authorized staff can read ingested emails"
  ON public.ingested_emails FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 8. agent_events: restrict to admins
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "agent_events_read" ON public.agent_events; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can read agent events" ON public.agent_events; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can read agent events"
  ON public.agent_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 9. email_events: restrict to admins
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view email events" ON public.email_events; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view email events" ON public.email_events; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view email events"
  ON public.email_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 10. certificates_of_analysis: restrict SELECT to staff
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_select_auth" ON public.certificates_of_analysis; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can view COAs" ON public.certificates_of_analysis; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can view COAs"
  ON public.certificates_of_analysis FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    OR generated_by = auth.uid()
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 11. formula_user_permissions: restrict enumeration
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view formula permissions" ON public.formula_user_permissions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "View own or managed formula permissions" ON public.formula_user_permissions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "View own or managed formula permissions"
  ON public.formula_user_permissions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 12. STORAGE: coa-files bucket - require auth + roles
-- ============================================================
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view COA files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can upload COA files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update COA files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete COA files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_files_select_auth" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "coa_files_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'coa-files'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_files_insert_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "coa_files_insert_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coa-files' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_files_update_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "coa_files_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coa-files' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_files_delete_admin" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "coa_files_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'coa-files' AND public.has_role(auth.uid(), 'admin'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 13. STORAGE: order-pdfs bucket - make private + tighten
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'order-pdfs';

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can upload order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "order_pdfs_select_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "order_pdfs_select_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-pdfs' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
      OR public.has_role(auth.uid(), 'rd_manager'::app_role)
      OR public.has_role(auth.uid(), 'hr_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "order_pdfs_write_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "order_pdfs_write_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-pdfs' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "order_pdfs_update_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "order_pdfs_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'order-pdfs' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "order_pdfs_delete_admin" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "order_pdfs_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'order-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- 14. STORAGE: po-attachments bucket - make private + add policies
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'po-attachments';

DO $pol$ BEGIN DROP POLICY IF EXISTS "po_attachments_select_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "po_attachments_select_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'po-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
      OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "po_attachments_insert_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "po_attachments_insert_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'po-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "po_attachments_update_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "po_attachments_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'po-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "po_attachments_delete_admin" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "po_attachments_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'po-attachments' AND public.has_role(auth.uid(), 'admin'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
