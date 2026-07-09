-- Update profiles table to support additional fields for user display and profile management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS job_title text;