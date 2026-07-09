
-- ============================================================
-- 1. inquiry_messages: remove anon access
-- ============================================================
DROP POLICY IF EXISTS "Allow viewing recently created messages" ON public.inquiry_messages;

-- ============================================================
-- 2. inquiry_order_details: remove anon access
-- ============================================================
DROP POLICY IF EXISTS "Allow viewing recently created order details" ON public.inquiry_order_details;

-- ============================================================
-- 3. user_roles: restrict SELECT
-- ============================================================
DROP POLICY IF EXISTS "All authenticated users can view user roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. formula_access_requests: tighten UPDATE/DELETE/SELECT
-- ============================================================
DROP POLICY IF EXISTS "All authenticated users can update formula access requests" ON public.formula_access_requests;
DROP POLICY IF EXISTS "All authenticated users can delete formula access requests" ON public.formula_access_requests;
DROP POLICY IF EXISTS "All authenticated users can view formula access requests" ON public.formula_access_requests;

CREATE POLICY "View formula access requests"
  ON public.formula_access_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  );

CREATE POLICY "Authorized roles can update formula access requests"
  ON public.formula_access_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rd_manager'::app_role))
    AND approved_by IS DISTINCT FROM user_id
  );

CREATE POLICY "Authorized roles can delete formula access requests"
  ON public.formula_access_requests FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    OR user_id = auth.uid()
  );

-- ============================================================
-- 5. user_activity_audit: admins only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view activity audit" ON public.user_activity_audit;
CREATE POLICY "Admins can view activity audit"
  ON public.user_activity_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 6. formula_access_audit: admins only
-- ============================================================
DROP POLICY IF EXISTS "All authenticated users can view formula access audit" ON public.formula_access_audit;
CREATE POLICY "Admins can view formula access audit"
  ON public.formula_access_audit FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  );

-- ============================================================
-- 7. ingested_emails: restrict to admin/production_manager
-- ============================================================
DROP POLICY IF EXISTS "ingested_emails_read" ON public.ingested_emails;
CREATE POLICY "Authorized staff can read ingested emails"
  ON public.ingested_emails FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

-- ============================================================
-- 8. agent_events: restrict to admins
-- ============================================================
DROP POLICY IF EXISTS "agent_events_read" ON public.agent_events;
CREATE POLICY "Admins can read agent events"
  ON public.agent_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

-- ============================================================
-- 9. email_events: restrict to admins
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view email events" ON public.email_events;
CREATE POLICY "Admins can view email events"
  ON public.email_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

-- ============================================================
-- 10. certificates_of_analysis: restrict SELECT to staff
-- ============================================================
DROP POLICY IF EXISTS "coa_select_auth" ON public.certificates_of_analysis;
CREATE POLICY "Staff can view COAs"
  ON public.certificates_of_analysis FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    OR generated_by = auth.uid()
  );

-- ============================================================
-- 11. formula_user_permissions: restrict enumeration
-- ============================================================
DROP POLICY IF EXISTS "All authenticated users can view formula permissions" ON public.formula_user_permissions;
CREATE POLICY "View own or managed formula permissions"
  ON public.formula_user_permissions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
  );

-- ============================================================
-- 12. STORAGE: coa-files bucket - require auth + roles
-- ============================================================
DROP POLICY IF EXISTS "Users can view COA files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload COA files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update COA files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete COA files" ON storage.objects;

CREATE POLICY "coa_files_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'coa-files');

CREATE POLICY "coa_files_insert_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coa-files' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  );

CREATE POLICY "coa_files_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coa-files' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
    )
  );

CREATE POLICY "coa_files_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'coa-files' AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- 13. STORAGE: order-pdfs bucket - make private + tighten
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'order-pdfs';

DROP POLICY IF EXISTS "Authenticated users can view order PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update order PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete order PDFs" ON storage.objects;

CREATE POLICY "order_pdfs_select_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-pdfs' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
      OR public.has_role(auth.uid(), 'rd_manager'::app_role)
      OR public.has_role(auth.uid(), 'hr_manager'::app_role)
    )
  );

CREATE POLICY "order_pdfs_write_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-pdfs' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  );

CREATE POLICY "order_pdfs_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'order-pdfs' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  );

CREATE POLICY "order_pdfs_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'order-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- 14. STORAGE: po-attachments bucket - make private + add policies
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'po-attachments';

CREATE POLICY "po_attachments_select_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'po-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
      OR public.has_role(auth.uid(), 'quality_manager'::app_role)
      OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    )
  );

CREATE POLICY "po_attachments_insert_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'po-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  );

CREATE POLICY "po_attachments_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'po-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
    )
  );

CREATE POLICY "po_attachments_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'po-attachments' AND public.has_role(auth.uid(), 'admin'::app_role)
  );
