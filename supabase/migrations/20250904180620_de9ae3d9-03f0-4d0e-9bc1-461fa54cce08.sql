-- Fix purchase orders status inconsistency
-- First, update all existing 'pending' records to 'ordered' status
UPDATE public.purchase_orders 
SET status = 'ordered' 
WHERE status = 'pending';

-- Add proper status constraint to ensure only valid values
ALTER TABLE public.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders 
ADD CONSTRAINT purchase_orders_status_check 
CHECK (status IN ('ordered', 'received'));

-- Change the default status to 'ordered'
ALTER TABLE public.purchase_orders 
ALTER COLUMN status SET DEFAULT 'ordered';