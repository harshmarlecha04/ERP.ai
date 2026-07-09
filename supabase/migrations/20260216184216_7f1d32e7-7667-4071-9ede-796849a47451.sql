
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.order_headers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_unique ON public.email_events(order_id, event_type, recipient_email);
DO $rls$ BEGIN ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view email events" ON public.email_events; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view email events"
  ON public.email_events FOR SELECT
  TO authenticated
  USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
