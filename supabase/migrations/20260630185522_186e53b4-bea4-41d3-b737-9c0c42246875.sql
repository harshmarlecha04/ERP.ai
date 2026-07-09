
-- =========================
-- shipping_entries
-- =========================
CREATE TABLE IF NOT EXISTS public.shipping_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_completion_id UUID UNIQUE REFERENCES public.packaging_completion_records(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.packaging_schedule(id) ON DELETE SET NULL,
  order_header_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  order_line_item_id UUID REFERENCES public.order_line_items(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  product_name TEXT,
  bottle_count INTEGER,
  bottle_size TEXT,
  lot_number TEXT,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | ready_to_ship | invoiced
  ready_to_ship_at TIMESTAMPTZ,
  ready_to_ship_by UUID,
  invoice_id UUID,
  invoiced_at TIMESTAMPTZ,
  invoiced_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_entries TO authenticated;
GRANT ALL ON public.shipping_entries TO service_role;
DO $rls$ BEGIN ALTER TABLE public.shipping_entries ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can view shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can view shipping entries"
  ON public.shipping_entries FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can insert shipping entries"
  ON public.shipping_entries FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can update shipping entries"
  ON public.shipping_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete shipping entries" ON public.shipping_entries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can delete shipping entries"
  ON public.shipping_entries FOR DELETE TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

CREATE INDEX IF NOT EXISTS idx_shipping_entries_status ON public.shipping_entries(status);
CREATE INDEX IF NOT EXISTS idx_shipping_entries_customer ON public.shipping_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipping_entries_order ON public.shipping_entries(order_header_id);

-- =========================
-- customer_invoices
-- =========================
CREATE SEQUENCE IF NOT EXISTS public.customer_invoice_seq START 1;

CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  order_header_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  pdf_url TEXT,
  source TEXT DEFAULT 'shipping',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invoices TO authenticated;
GRANT ALL ON public.customer_invoices TO service_role;
DO $rls$ BEGIN ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can view invoices"
  ON public.customer_invoices FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can insert invoices"
  ON public.customer_invoices FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can update invoices"
  ON public.customer_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete invoices" ON public.customer_invoices; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can delete invoices"
  ON public.customer_invoices FOR DELETE TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- =========================
-- customer_invoice_lines
-- =========================
CREATE TABLE IF NOT EXISTS public.customer_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  shipping_entry_id UUID REFERENCES public.shipping_entries(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invoice_lines TO authenticated;
GRANT ALL ON public.customer_invoice_lines TO service_role;
DO $rls$ BEGIN ALTER TABLE public.customer_invoice_lines ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can view invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can view invoice lines"
  ON public.customer_invoice_lines FOR SELECT TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can insert invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can insert invoice lines"
  ON public.customer_invoice_lines FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can update invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can update invoice lines"
  ON public.customer_invoice_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated can delete invoice lines" ON public.customer_invoice_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated can delete invoice lines"
  ON public.customer_invoice_lines FOR DELETE TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- FK link from shipping_entries -> customer_invoices
ALTER TABLE public.shipping_entries DROP CONSTRAINT IF EXISTS shipping_entries_invoice_fk;
ALTER TABLE public.shipping_entries
  ADD CONSTRAINT shipping_entries_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES public.customer_invoices(id) ON DELETE SET NULL;

-- =========================
-- updated_at triggers
-- =========================
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='tg_set_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_shipping_entries_updated ON public.shipping_entries;
CREATE TRIGGER trg_shipping_entries_updated BEFORE UPDATE ON public.shipping_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_customer_invoices_updated ON public.customer_invoices;
CREATE TRIGGER trg_customer_invoices_updated BEFORE UPDATE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- Auto-create shipping_entries from packaging completion
-- =========================
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='fn_create_shipping_entry' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.fn_create_shipping_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sched RECORD;
  v_customer_id UUID;
BEGIN
  SELECT * INTO v_sched FROM public.packaging_schedule WHERE id = NEW.schedule_id;
  IF v_sched.id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE company_name = v_sched.customer_name LIMIT 1;

  INSERT INTO public.shipping_entries (
    packaging_completion_id, schedule_id, order_header_id, order_line_item_id,
    customer_id, customer_name, product_name, bottle_count, bottle_size, lot_number,
    completed_date, status
  ) VALUES (
    NEW.id, NEW.schedule_id, v_sched.order_header_id, NEW.order_line_item_id,
    v_customer_id, v_sched.customer_name, v_sched.product_name,
    NEW.bottles_packed, v_sched.count, v_sched.lot_number,
    NEW.completion_date, 'pending'
  )
  ON CONFLICT (packaging_completion_id) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_packaging_completion_to_shipping ON public.packaging_completion_records;
CREATE TRIGGER trg_packaging_completion_to_shipping
  AFTER INSERT ON public.packaging_completion_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_shipping_entry();

-- =========================
-- Backfill existing completions
-- =========================
INSERT INTO public.shipping_entries (
  packaging_completion_id, schedule_id, order_header_id, order_line_item_id,
  customer_id, customer_name, product_name, bottle_count, bottle_size, lot_number,
  completed_date, status
)
SELECT
  pcr.id, pcr.schedule_id, ps.order_header_id, pcr.order_line_item_id,
  (SELECT id FROM public.customers WHERE company_name = ps.customer_name LIMIT 1),
  ps.customer_name, ps.product_name, pcr.bottles_packed, ps.count, ps.lot_number,
  pcr.completion_date, 'pending'
FROM public.packaging_completion_records pcr
LEFT JOIN public.packaging_schedule ps ON ps.id = pcr.schedule_id
ON CONFLICT (packaging_completion_id) DO NOTHING;

-- =========================
-- Invoice numbering helper
-- =========================
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='next_invoice_number' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.customer_invoice_seq');
  RETURN 'INV-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 4, '0');
END $$;
