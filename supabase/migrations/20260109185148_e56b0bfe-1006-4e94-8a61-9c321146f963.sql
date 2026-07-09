-- Create dashboard_shortcuts table for per-user layout persistence
CREATE TABLE IF NOT EXISTS public.dashboard_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, shortcut_key)
);

-- Enable RLS
DO $rls$ BEGIN ALTER TABLE public.dashboard_shortcuts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Users can only see their own shortcuts
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own shortcuts" ON public.dashboard_shortcuts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view own shortcuts"
ON public.dashboard_shortcuts FOR SELECT
TO authenticated
USING (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can insert their own shortcuts
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can insert own shortcuts" ON public.dashboard_shortcuts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can insert own shortcuts"
ON public.dashboard_shortcuts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can update their own shortcuts
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update own shortcuts" ON public.dashboard_shortcuts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can update own shortcuts"
ON public.dashboard_shortcuts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Users can delete their own shortcuts
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete own shortcuts" ON public.dashboard_shortcuts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete own shortcuts"
ON public.dashboard_shortcuts FOR DELETE
TO authenticated
USING (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_dashboard_shortcuts_user_id ON public.dashboard_shortcuts(user_id);