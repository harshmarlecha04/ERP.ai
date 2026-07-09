
-- 1. Pouch inventory
CREATE TABLE public.pouch_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity_on_hand integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pouch',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pouch_inventory TO authenticated;
GRANT ALL ON public.pouch_inventory TO service_role;

ALTER TABLE public.pouch_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pouch inventory"
  ON public.pouch_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage pouch inventory"
  ON public.pouch_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pouch_inventory_updated_at
  BEFORE UPDATE ON public.pouch_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Extend bright_stock
ALTER TABLE public.bright_stock
  ADD COLUMN IF NOT EXISTS form text NOT NULL DEFAULT 'bottled',
  ADD COLUMN IF NOT EXISTS qty_gummies integer,
  ADD COLUMN IF NOT EXISTS pouch_inventory_id uuid REFERENCES public.pouch_inventory(id),
  ADD COLUMN IF NOT EXISTS pouches_used integer,
  ADD COLUMN IF NOT EXISTS gummies_per_pouch integer,
  ADD COLUMN IF NOT EXISTS is_labeled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS label_customer_product text;

-- 3. Extend packaging_completion_records
ALTER TABLE public.packaging_completion_records
  ADD COLUMN IF NOT EXISTS extra_form text,
  ADD COLUMN IF NOT EXISTS extra_is_labeled boolean,
  ADD COLUMN IF NOT EXISTS extra_pouches_used integer,
  ADD COLUMN IF NOT EXISTS extra_gummies_per_pouch integer,
  ADD COLUMN IF NOT EXISTS extra_total_gummies integer,
  ADD COLUMN IF NOT EXISTS extra_bottle_count text,
  ADD COLUMN IF NOT EXISTS extra_label_customer_product text,
  ADD COLUMN IF NOT EXISTS extra_pouch_inventory_id uuid REFERENCES public.pouch_inventory(id);
