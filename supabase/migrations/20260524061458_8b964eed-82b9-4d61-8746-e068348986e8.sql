-- User-scoped saved table views (filters, sort, columns, page size per list page)
CREATE TABLE public.user_table_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_key TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_table_views_user_page ON public.user_table_views(user_id, page_key);

-- Each user can only have one default per page
CREATE UNIQUE INDEX uniq_user_table_views_default
  ON public.user_table_views(user_id, page_key)
  WHERE is_default = true;

ALTER TABLE public.user_table_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own table views"
  ON public.user_table_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own table views"
  ON public.user_table_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own table views"
  ON public.user_table_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own table views"
  ON public.user_table_views FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Reuse the existing public.update_updated_at_column() trigger function
CREATE TRIGGER trg_user_table_views_updated_at
  BEFORE UPDATE ON public.user_table_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();