-- Create dashboard_shortcuts table for per-user layout persistence
CREATE TABLE public.dashboard_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, shortcut_key)
);

-- Enable RLS
ALTER TABLE public.dashboard_shortcuts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own shortcuts
CREATE POLICY "Users can view own shortcuts"
ON public.dashboard_shortcuts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own shortcuts
CREATE POLICY "Users can insert own shortcuts"
ON public.dashboard_shortcuts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own shortcuts
CREATE POLICY "Users can update own shortcuts"
ON public.dashboard_shortcuts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own shortcuts
CREATE POLICY "Users can delete own shortcuts"
ON public.dashboard_shortcuts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX idx_dashboard_shortcuts_user_id ON public.dashboard_shortcuts(user_id);