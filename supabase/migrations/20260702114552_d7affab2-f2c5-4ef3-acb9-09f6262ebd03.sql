
-- customer_invoices
DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Authenticated can update invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Authenticated can delete invoices" ON public.customer_invoices;

CREATE POLICY "View invoices (staff or own customer)" ON public.customer_invoices
  FOR SELECT TO authenticated
  USING (
    public.has_financial_access()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR customer_id = public.get_my_customer_id()
  );
CREATE POLICY "Staff can insert invoices" ON public.customer_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can update invoices" ON public.customer_invoices
  FOR UPDATE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can delete invoices" ON public.customer_invoices
  FOR DELETE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role));

-- customer_invoice_lines
DROP POLICY IF EXISTS "Authenticated can view invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Authenticated can insert invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Authenticated can update invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Authenticated can delete invoice lines" ON public.customer_invoice_lines;

CREATE POLICY "View invoice lines (staff or own customer)" ON public.customer_invoice_lines
  FOR SELECT TO authenticated
  USING (
    public.has_financial_access()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.customer_invoices ci
      WHERE ci.id = customer_invoice_lines.invoice_id
        AND ci.customer_id = public.get_my_customer_id()
    )
  );
CREATE POLICY "Staff can insert invoice lines" ON public.customer_invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can update invoice lines" ON public.customer_invoice_lines
  FOR UPDATE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can delete invoice lines" ON public.customer_invoice_lines
  FOR DELETE TO authenticated
  USING (public.has_financial_access() OR public.has_role(auth.uid(), 'admin'::app_role));

-- shipping_entries
DROP POLICY IF EXISTS "Authenticated can view shipping entries" ON public.shipping_entries;
DROP POLICY IF EXISTS "Authenticated can insert shipping entries" ON public.shipping_entries;
DROP POLICY IF EXISTS "Authenticated can update shipping entries" ON public.shipping_entries;
DROP POLICY IF EXISTS "Authenticated can delete shipping entries" ON public.shipping_entries;

CREATE POLICY "View shipping entries (staff or own customer)" ON public.shipping_entries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
    OR public.has_role(auth.uid(), 'rd_manager'::app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::app_role)
    OR customer_id = public.get_my_customer_id()
  );
CREATE POLICY "Staff can insert shipping entries" ON public.shipping_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'quality_manager'::app_role)
  );
CREATE POLICY "Staff can update shipping entries" ON public.shipping_entries
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
  );
CREATE POLICY "Staff can delete shipping entries" ON public.shipping_entries
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

-- inquiry_messages INSERT
DROP POLICY IF EXISTS "Authenticated users can insert inquiry messages" ON public.inquiry_messages;
CREATE POLICY "Scoped insert inquiry messages" ON public.inquiry_messages
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
  );

-- rd_base_templates
DROP POLICY IF EXISTS "Authenticated can read rd_base_templates" ON public.rd_base_templates;
DROP POLICY IF EXISTS "Authenticated can insert rd_base_templates" ON public.rd_base_templates;
DROP POLICY IF EXISTS "Authenticated can update rd_base_templates" ON public.rd_base_templates;
DROP POLICY IF EXISTS "Authenticated can delete rd_base_templates" ON public.rd_base_templates;
CREATE POLICY "Staff read rd_base_templates" ON public.rd_base_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role));
CREATE POLICY "Staff write rd_base_templates" ON public.rd_base_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role));

DROP POLICY IF EXISTS "Authenticated can read rd_base_template_steps" ON public.rd_base_template_steps;
DROP POLICY IF EXISTS "Authenticated can insert rd_base_template_steps" ON public.rd_base_template_steps;
DROP POLICY IF EXISTS "Authenticated can update rd_base_template_steps" ON public.rd_base_template_steps;
DROP POLICY IF EXISTS "Authenticated can delete rd_base_template_steps" ON public.rd_base_template_steps;
CREATE POLICY "Staff read rd_base_template_steps" ON public.rd_base_template_steps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role));
CREATE POLICY "Staff write rd_base_template_steps" ON public.rd_base_template_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role));

DROP POLICY IF EXISTS "Authenticated can read rd_base_template_ingredients" ON public.rd_base_template_ingredients;
DROP POLICY IF EXISTS "Authenticated can insert rd_base_template_ingredients" ON public.rd_base_template_ingredients;
DROP POLICY IF EXISTS "Authenticated can update rd_base_template_ingredients" ON public.rd_base_template_ingredients;
DROP POLICY IF EXISTS "Authenticated can delete rd_base_template_ingredients" ON public.rd_base_template_ingredients;
CREATE POLICY "Staff read rd_base_template_ingredients" ON public.rd_base_template_ingredients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role));
CREATE POLICY "Staff write rd_base_template_ingredients" ON public.rd_base_template_ingredients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'rd_manager'::app_role) OR public.has_role(auth.uid(),'production_manager'::app_role) OR public.has_role(auth.uid(),'quality_manager'::app_role));
