
CREATE TABLE IF NOT EXISTS public.order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
DO $rls$ BEGIN ALTER TABLE public.order_drafts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users manage own drafts" ON public.order_drafts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users manage own drafts" ON public.order_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DROP TRIGGER IF EXISTS update_order_drafts_updated_at ON public.order_drafts;
CREATE TRIGGER update_order_drafts_updated_at
  BEFORE UPDATE ON public.order_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
