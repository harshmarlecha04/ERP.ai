-- Create direct_messages table for internal team communication
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS Policy: Users can view messages where they are sender OR receiver
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own messages" ON public.direct_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own messages"
  ON public.direct_messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policy: Users can insert messages where they are the sender
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can send messages"
  ON public.direct_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policy: Users can update their received messages (mark as read)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can mark messages as read" ON public.direct_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can mark messages as read"
  ON public.direct_messages
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at DESC);

-- Add to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Function to sync profile data from auth.users metadata
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='sync_profile_from_auth' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert profile with auth metadata
  INSERT INTO public.profiles (id, email, display_name, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'job_title', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', EXCLUDED.email),
    job_title = COALESCE(NEW.raw_user_meta_data->>'job_title', EXCLUDED.job_title),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-sync profiles when auth.users is updated
DROP TRIGGER IF EXISTS on_auth_user_created_sync_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_sync_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_profile
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_auth();

-- Manually sync existing users to profiles table
INSERT INTO public.profiles (id, email, display_name, job_title)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'display_name', au.email) as display_name,
  COALESCE(au.raw_user_meta_data->>'job_title', '') as job_title
FROM auth.users au
WHERE au.email LIKE '%@pharmvista.com'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  job_title = EXCLUDED.job_title,
  updated_at = NOW();