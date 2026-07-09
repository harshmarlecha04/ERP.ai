
-- Add order link to packaging_schedule for fulfillment reconciliation
ALTER TABLE public.packaging_schedule
  ADD COLUMN IF NOT EXISTS order_line_item_id uuid REFERENCES public.order_line_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_packaging_schedule_order_line ON public.packaging_schedule(order_line_item_id);

-- Add order_line_item_id to packaging_completion_records for direct linking
ALTER TABLE public.packaging_completion_records
  ADD COLUMN IF NOT EXISTS order_line_item_id uuid REFERENCES public.order_line_items(id) ON DELETE SET NULL;
