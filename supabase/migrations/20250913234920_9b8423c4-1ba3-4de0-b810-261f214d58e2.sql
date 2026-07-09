-- Add missing columns to profiles table that handle_new_user function expects
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS full_name text;

-- Update the existing profiles if any to sync with auth.users
UPDATE public.profiles 
SET 
  email = au.email,
  full_name = COALESCE(au.raw_user_meta_data->>'full_name', au.email)
FROM auth.users au 
WHERE profiles.id = au.id;