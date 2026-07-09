
ALTER TABLE public.rd_project_versions
  ADD COLUMN IF NOT EXISTS qa_received_by uuid,
  ADD COLUMN IF NOT EXISTS qa_received_at timestamptz;

ALTER TABLE public.rd_project_versions
  ALTER COLUMN status SET DEFAULT 'scheduled';

UPDATE public.rd_project_versions
  SET status = 'scheduled'
  WHERE status = 'pending_approval';
