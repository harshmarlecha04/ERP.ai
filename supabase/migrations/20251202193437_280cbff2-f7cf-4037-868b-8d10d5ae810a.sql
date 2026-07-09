-- Create table for storing assistant conversations
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
DO $rls$ BEGIN ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Users can only manage their own conversations
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own conversations" ON public.assistant_conversations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view own conversations"
  ON public.assistant_conversations FOR SELECT
  USING (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create own conversations" ON public.assistant_conversations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can create own conversations"
  ON public.assistant_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update own conversations" ON public.assistant_conversations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can update own conversations"
  ON public.assistant_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete own conversations" ON public.assistant_conversations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete own conversations"
  ON public.assistant_conversations FOR DELETE
  USING (auth.uid() = user_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated_at ON public.assistant_conversations(updated_at DESC);