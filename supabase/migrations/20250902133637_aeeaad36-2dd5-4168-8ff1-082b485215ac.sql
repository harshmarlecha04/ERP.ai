-- Add received status and related columns to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN received_date DATE,
ADD COLUMN received_by UUID;

-- Update status constraint to include 'received'
ALTER TABLE public.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders 
ADD CONSTRAINT purchase_orders_status_check 
CHECK (status IN ('pending', 'ordered', 'shipped', 'delivered', 'received', 'cancelled'));