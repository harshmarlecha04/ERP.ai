-- Add vendor_name and ingredient_name text columns to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS ingredient_name TEXT;

-- Make vendor_id and ingredient_id nullable for backward compatibility
ALTER TABLE public.purchase_orders 
ALTER COLUMN vendor_id DROP NOT NULL,
ALTER COLUMN ingredient_id DROP NOT NULL;