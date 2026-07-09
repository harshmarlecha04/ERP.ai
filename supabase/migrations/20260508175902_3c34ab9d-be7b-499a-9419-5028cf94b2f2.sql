CREATE TABLE IF NOT EXISTS public.po_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.order_headers(id) ON DELETE CASCADE,
  pdf_path text NOT NULL,
  raw_extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  model_used text,
  applied_at timestamptz,
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_scan_results_order_id ON public.po_scan_results(order_id);

ALTER TABLE public.po_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view PO scan results"
  ON public.po_scan_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert PO scan results"
  ON public.po_scan_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update PO scan results"
  ON public.po_scan_results FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete PO scan results"
  ON public.po_scan_results FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_po_scan_results_updated_at
  BEFORE UPDATE ON public.po_scan_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();