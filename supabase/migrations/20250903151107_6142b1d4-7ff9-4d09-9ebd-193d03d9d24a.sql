-- Add new columns for multiple emails and phone numbers
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS phone_numbers JSONB DEFAULT '[]'::jsonb;