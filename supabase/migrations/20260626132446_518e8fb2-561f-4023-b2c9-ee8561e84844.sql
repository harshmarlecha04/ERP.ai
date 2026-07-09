ALTER TABLE public.packaging_movement
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS order_header_id uuid REFERENCES public.order_headers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packaging_movement_order_header ON public.packaging_movement(order_header_id);

ALTER TABLE public.packaging_schedule
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS order_header_id uuid REFERENCES public.order_headers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packaging_schedule_order_header ON public.packaging_schedule(order_header_id);