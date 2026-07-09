
-- Storage bucket for label review PDFs and generated reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-reviews', 'label-reviews', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can manage files in their own folder; admins can manage all
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users read own label-reviews files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users read own label-reviews files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'label-reviews'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users upload own label-reviews files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users upload own label-reviews files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'label-reviews'
  AND auth.uid()::text = (storage.foldername(name))[1]
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users delete own label-reviews files" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users delete own label-reviews files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'label-reviews'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Table to track label review jobs
CREATE TABLE IF NOT EXISTS public.label_reviews (
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
DO $rls$ BEGIN ALTER TABLE public.label_reviews ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users view own label_reviews" ON public.label_reviews; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users view own label_reviews"
ON public.label_reviews FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users insert own label_reviews" ON public.label_reviews; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users insert own label_reviews"
ON public.label_reviews FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users update own label_reviews" ON public.label_reviews; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users update own label_reviews"
ON public.label_reviews FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users delete own label_reviews" ON public.label_reviews; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users delete own label_reviews"
ON public.label_reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DROP TRIGGER IF EXISTS trg_label_reviews_updated_at ON public.label_reviews;
CREATE TRIGGER trg_label_reviews_updated_at
BEFORE UPDATE ON public.label_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_label_reviews_user_created ON public.label_reviews (user_id, created_at DESC);
