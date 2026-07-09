-- Add address column to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;