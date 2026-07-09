-- Add unit of measurement column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'kg';