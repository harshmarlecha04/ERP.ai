
-- Storage bucket for label review PDFs and generated reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-reviews', 'label-reviews', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can manage files in their own folder; admins can manage all
CREATE POLICY "Users read own label-reviews files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'label-reviews'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users upload own label-reviews files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'label-reviews'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own label-reviews files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'label-reviews'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

-- Table to track label review jobs
CREATE TABLE public.label_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label_file_name TEXT NOT NULL,
  label_file_path TEXT NOT NULL,
  report_file_path TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.label_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own label_reviews"
ON public.label_reviews FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own label_reviews"
ON public.label_reviews FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own label_reviews"
ON public.label_reviews FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own label_reviews"
ON public.label_reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_label_reviews_updated_at
BEFORE UPDATE ON public.label_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_label_reviews_user_created ON public.label_reviews (user_id, created_at DESC);
