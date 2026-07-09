ALTER TABLE public.order_line_items
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS bottle_container text,
  ADD COLUMN IF NOT EXISTS price_per_unit numeric(12,2),
  ADD COLUMN IF NOT EXISTS line_total numeric(14,2)
    GENERATED ALWAYS AS (COALESCE(price_per_unit,0) * COALESCE(bottles_ordered,0)) STORED;