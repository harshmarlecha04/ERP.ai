
-- customer_invoices
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "View invoices (staff or own customer)" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "View invoices (staff or own customer)" ON public.customer_invoices
  FOR SELECT TO authenticated
  USING (
    public.has_financial_access()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR customer_id = public.get_my_customer_id()
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can insert invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can insert invoices" ON public.customer_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can update invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can update invoices" ON public.customer_invoices
  FOR UPDATE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can delete invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can delete invoices" ON public.customer_invoices
  FOR DELETE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- customer_invoice_lines
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can view invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "View invoice lines (staff or own customer)" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "View invoice lines (staff or own customer)" ON public.customer_invoice_lines
  FOR SELECT TO authenticated
  USING (
    public.has_financial_access()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.customer_invoices ci
      WHERE ci.id = customer_invoice_lines.invoice_id
        AND ci.customer_id = public.get_my_customer_id()
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can insert invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can insert invoice lines" ON public.customer_invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can update invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can update invoice lines" ON public.customer_invoice_lines
  FOR UPDATE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can delete invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can delete invoice lines" ON public.customer_invoice_lines
  FOR DELETE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- shipping_entries
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can view shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "View shipping entries (staff or own customer)" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "View shipping entries (staff or own customer)" ON public.shipping_entries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::app_role)
    OR customer_id = public.get_my_customer_id()
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can insert shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can insert shipping entries" ON public.shipping_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can update shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can update shipping entries" ON public.shipping_entries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can delete shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can delete shipping entries" ON public.shipping_entries
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- inquiry_messages INSERT
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can insert inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Scoped insert inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Scoped insert inquiry messages" ON public.inquiry_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'production_manager'::app_role)
      OR public.has_role(auth.uid(), 'hr_manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.customer_inquiries ci
        WHERE ci.id = inquiry_messages.inquiry_id
          AND ci.customer_id = public.get_my_customer_id()
      )
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- rd_base_templates
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can read rd_base_templates" ON public.rd_base_templates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert rd_base_templates" ON public.rd_base_templates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update rd_base_templates" ON public.rd_base_templates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete rd_base_templates" ON public.rd_base_templates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff read rd_base_templates" ON public.rd_base_templates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff read rd_base_templates" ON public.rd_base_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff write rd_base_templates" ON public.rd_base_templates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff write rd_base_templates" ON public.rd_base_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can read rd_base_template_steps" ON public.rd_base_template_steps; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert rd_base_template_steps" ON public.rd_base_template_steps; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update rd_base_template_steps" ON public.rd_base_template_steps; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete rd_base_template_steps" ON public.rd_base_template_steps; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff read rd_base_template_steps" ON public.rd_base_template_steps; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff read rd_base_template_steps" ON public.rd_base_template_steps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff write rd_base_template_steps" ON public.rd_base_template_steps; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff write rd_base_template_steps" ON public.rd_base_template_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can read rd_base_template_ingredients" ON public.rd_base_template_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert rd_base_template_ingredients" ON public.rd_base_template_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update rd_base_template_ingredients" ON public.rd_base_template_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete rd_base_template_ingredients" ON public.rd_base_template_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff read rd_base_template_ingredients" ON public.rd_base_template_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff read rd_base_template_ingredients" ON public.rd_base_template_ingredients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff write rd_base_template_ingredients" ON public.rd_base_template_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff write rd_base_template_ingredients" ON public.rd_base_template_ingredients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
