-- Add unit of measurement column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN uom TEXT DEFAULT 'kg';