-- Tables that existed on the original database but were created outside the migration chain.
-- Schemas reconstructed from the generated Supabase types (src/integrations/supabase/types.ts).

CREATE TABLE IF NOT EXISTS public.approval_tokens (
  agent_event_id uuid,
  approval_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  decided_at timestamptz,
  decision text,
  expires_at timestamptz NOT NULL,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL,
  token text NOT NULL,
  used boolean,
  user_id uuid
);
ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_tokens_authenticated_all" ON public.approval_tokens;
CREATE POLICY "approval_tokens_authenticated_all" ON public.approval_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.chatbot_knowledge (
  category text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean,
  keywords text[] NOT NULL,
  last_used text,
  source text NOT NULL,
  taught_by uuid,
  title text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  usage_count numeric
);
ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_knowledge_authenticated_all" ON public.chatbot_knowledge;
CREATE POLICY "chatbot_knowledge_authenticated_all" ON public.chatbot_knowledge FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.graph_tokens (
  access_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message_id uuid,
  last_poll_at timestamptz,
  mailbox_email text NOT NULL,
  refresh_token text NOT NULL,
  user_id uuid,
  webhook_expires_at timestamptz,
  webhook_subscription_id uuid
);
ALTER TABLE public.graph_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "graph_tokens_authenticated_all" ON public.graph_tokens;
CREATE POLICY "graph_tokens_authenticated_all" ON public.graph_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.schedule_change_history (
  affected_dates text[] NOT NULL,
  affected_item_ids text[] NOT NULL,
  change_type text NOT NULL,
  changed_by uuid,
  created_at timestamptz DEFAULT now(),
  description text NOT NULL,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reverted boolean,
  reverted_at timestamptz,
  reverted_by uuid,
  snapshot_after jsonb NOT NULL,
  snapshot_before jsonb NOT NULL
);
ALTER TABLE public.schedule_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule_change_history_authenticated_all" ON public.schedule_change_history;
CREATE POLICY "schedule_change_history_authenticated_all" ON public.schedule_change_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
