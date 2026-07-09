CREATE TABLE public.rd_flavor_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_flavor_options TO authenticated;
GRANT ALL ON public.rd_flavor_options TO service_role;

ALTER TABLE public.rd_flavor_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read flavor options"
  ON public.rd_flavor_options FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert flavor options"
  ON public.rd_flavor_options FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);