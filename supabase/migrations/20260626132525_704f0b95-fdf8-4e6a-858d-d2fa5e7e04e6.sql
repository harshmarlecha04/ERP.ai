ALTER TABLE public.label_inventory
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS order_header_id uuid REFERENCES public.order_headers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_label_inventory_order_header ON public.label_inventory(order_header_id);