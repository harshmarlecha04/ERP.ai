-- Add new columns for multiple emails and phone numbers
ALTER TABLE public.suppliers 
ADD COLUMN emails JSONB DEFAULT '[]'::jsonb,
ADD COLUMN phone_numbers JSONB DEFAULT '[]'::jsonb;