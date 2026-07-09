
-- ---------- AUDIT EVENTS ----------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  before JSONB,
  after JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_events(actor_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read audit" ON public.audit_events;
CREATE POLICY "Authenticated read audit" ON public.audit_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_events;
CREATE POLICY "Authenticated insert audit" ON public.audit_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fn_record_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT;
  v_before JSONB; v_after JSONB; v_action TEXT; v_entity_id TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_after := to_jsonb(NEW); v_entity_id := COALESCE((NEW).id::text,'');
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_before := to_jsonb(OLD); v_after := to_jsonb(NEW); v_entity_id := COALESCE((NEW).id::text,'');
  ELSE
    v_action := 'delete'; v_before := to_jsonb(OLD); v_entity_id := COALESCE((OLD).id::text,'');
  END IF;
  INSERT INTO public.audit_events(entity_type, entity_id, action, actor_id, actor_email, before, after)
  VALUES (TG_TABLE_NAME, v_entity_id, v_action, v_actor, v_email, v_before, v_after);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------- NOTIFICATIONS: realtime on existing table ----------
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- ---------- NOTIFICATION PREFERENCES ----------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  categories JSONB NOT NULL DEFAULT '{"po":true,"qa":true,"inventory":true,"mention":true,"ai":true,"task":true}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage prefs" ON public.notification_preferences;
CREATE POLICY "Users manage prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- TASKS ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('open','in_progress','done','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='task_priority') THEN
    CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  related_entity_type TEXT,
  related_entity_id TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON public.tasks(assignee_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_related ON public.tasks(related_entity_type, related_entity_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read tasks" ON public.tasks;
CREATE POLICY "Authenticated read tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert tasks" ON public.tasks;
CREATE POLICY "Authenticated insert tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Assignee creator admin update" ON public.tasks;
CREATE POLICY "Assignee creator admin update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (assignee_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Creator admin delete" ON public.tasks;
CREATE POLICY "Creator admin delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tasks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_notify_task_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NEW.assignee_id <> COALESCE(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications(user_id, type, title, message, action_url, data)
    VALUES (
      NEW.assignee_id,
      'task',
      'New task: ' || NEW.title,
      NEW.description,
      '/tasks?id=' || NEW.id,
      jsonb_build_object('severity',
        CASE NEW.priority WHEN 'urgent' THEN 'error' WHEN 'high' THEN 'warning' ELSE 'info' END,
        'entity_type','task','entity_id',NEW.id,'priority',NEW.priority)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_notify_assignment ON public.tasks;
CREATE TRIGGER trg_tasks_notify_assignment
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_task_assignment();

-- ---------- MENTIONS ----------
CREATE TABLE IF NOT EXISTS public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  context TEXT,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON public.mentions(mentioned_user_id, created_at DESC);
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own mentions" ON public.mentions;
CREATE POLICY "Read own mentions" ON public.mentions
  FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid() OR mentioned_by = auth.uid());

DROP POLICY IF EXISTS "Insert mentions" ON public.mentions;
CREATE POLICY "Insert mentions" ON public.mentions
  FOR INSERT TO authenticated WITH CHECK (mentioned_by = auth.uid());

CREATE OR REPLACE FUNCTION public.fn_notify_mention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mentioned_user_id <> COALESCE(NEW.mentioned_by,'00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications(user_id, type, title, message, action_url, data)
    VALUES (
      NEW.mentioned_user_id,
      'mention',
      'You were mentioned',
      NEW.context,
      NEW.link,
      jsonb_build_object('severity','info','entity_type',NEW.source_type,'entity_id',NEW.source_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mentions_notify ON public.mentions;
CREATE TRIGGER trg_mentions_notify
  AFTER INSERT ON public.mentions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_mention();
