ALTER TABLE public.label_reviews
  ADD COLUMN IF NOT EXISTS gummy_base text,
  ADD COLUMN IF NOT EXISTS reviewer_name text,
  ADD COLUMN IF NOT EXISTS review_type text;