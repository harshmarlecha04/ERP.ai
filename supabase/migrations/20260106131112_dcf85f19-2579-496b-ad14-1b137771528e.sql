-- Fix profiles table security
-- 1. Remove duplicate SELECT policy (keep one clear policy name)
-- 2. Ensure email_visible_to_public has NOT NULL constraint with safe default

-- Remove the duplicate/redundant SELECT policy
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can only view their own complete profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Ensure email_visible_to_public cannot be null (default already false)
UPDATE public.profiles SET email_visible_to_public = false WHERE email_visible_to_public IS NULL;
ALTER TABLE public.profiles ALTER COLUMN email_visible_to_public SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN email_visible_to_public SET DEFAULT false;