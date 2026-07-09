-- Drop the existing unique constraint on po_number
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;

-- Add a composite unique constraint on po_number and ingredient_id
-- This allows the same PO number for different ingredients
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_ingredient_key;
ALTER TABLE public.purchase_orders 
ADD CONSTRAINT purchase_orders_po_number_ingredient_key 
UNIQUE (po_number, ingredient_id);