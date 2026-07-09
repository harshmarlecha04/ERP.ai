
-- =====================================================
-- PO Fulfillment Workflow: Schema Changes
-- =====================================================

-- 1. New table: order_shipment_lines
CREATE TABLE IF NOT EXISTS public.order_shipment_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES public.order_shipments(id) ON DELETE CASCADE,
  order_line_id uuid NOT NULL REFERENCES public.order_line_items(id) ON DELETE CASCADE,
  qty_shipped integer NOT NULL DEFAULT 0,
  qty_accepted integer NULL,
  acceptance_status text NOT NULL DEFAULT 'PENDING',
  customer_confirmation_doc_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $rls$ BEGIN ALTER TABLE public.order_shipment_lines ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage shipment lines" ON public.order_shipment_lines; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage shipment lines" ON public.order_shipment_lines
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. New table: finished_goods_excess_transactions
CREATE TABLE IF NOT EXISTS public.finished_goods_excess_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bright_stock_id uuid REFERENCES public.bright_stock(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.order_headers(id) ON DELETE SET NULL,
  line_item_id uuid REFERENCES public.order_line_items(id) ON DELETE SET NULL,
  transaction_type text NOT NULL,
  qty integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  notes text NULL
);
DO $rls$ BEGIN ALTER TABLE public.finished_goods_excess_transactions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage excess transactions" ON public.finished_goods_excess_transactions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage excess transactions" ON public.finished_goods_excess_transactions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. New table: order_fulfillment_wizard_runs
CREATE TABLE IF NOT EXISTS public.order_fulfillment_wizard_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.order_headers(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 1,
  step_status jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  completed_by uuid NULL
);
DO $rls$ BEGIN ALTER TABLE public.order_fulfillment_wizard_runs ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage wizard runs" ON public.order_fulfillment_wizard_runs; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage wizard runs" ON public.order_fulfillment_wizard_runs
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 4. Alter order_line_items: add fulfillment tracking columns
ALTER TABLE public.order_line_items
  ADD COLUMN IF NOT EXISTS qty_allocated_from_excess integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_to_produce integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_packed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_shipped_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_accepted_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoiceable_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'not_invoiced',
  ADD COLUMN IF NOT EXISTS excess_created integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortage_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortage_status text NULL;

-- 5. Alter order_headers: add intake + fulfillment fields
ALTER TABLE public.order_headers
  ADD COLUMN IF NOT EXISTS received_via text NULL,
  ADD COLUMN IF NOT EXISTS received_from_email text NULL,
  ADD COLUMN IF NOT EXISTS received_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS wizard_run_id uuid NULL REFERENCES public.order_fulfillment_wizard_runs(id) ON DELETE SET NULL;

-- 6. Alter order_shipments: add order_id for order-level shipments
ALTER TABLE public.order_shipments
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.order_headers(id) ON DELETE CASCADE;

-- Make line_item_id nullable for backwards compat (order-level shipments)
ALTER TABLE public.order_shipments
  ALTER COLUMN line_item_id DROP NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipment_lines_shipment ON public.order_shipment_lines(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_line_item ON public.order_shipment_lines(order_line_id);
CREATE INDEX IF NOT EXISTS idx_excess_tx_bright_stock ON public.finished_goods_excess_transactions(bright_stock_id);
CREATE INDEX IF NOT EXISTS idx_excess_tx_order ON public.finished_goods_excess_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wizard_runs_order ON public.order_fulfillment_wizard_runs(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.order_shipments(order_id);
