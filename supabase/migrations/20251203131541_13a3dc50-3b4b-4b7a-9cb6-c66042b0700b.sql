-- Add order_header_id column to production_schedule_items for direct PO linking
ALTER TABLE public.production_schedule_items 
ADD COLUMN IF NOT EXISTS order_header_id UUID REFERENCES public.order_headers(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_production_schedule_items_order_header_id 
ON public.production_schedule_items(order_header_id);