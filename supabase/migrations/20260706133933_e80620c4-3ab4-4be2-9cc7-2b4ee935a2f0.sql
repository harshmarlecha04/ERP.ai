CREATE TABLE public.supplement_facts_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_version_id uuid REFERENCES public.rd_project_versions(id) ON DELETE SET NULL,
  rd_project_id uuid REFERENCES public.rd_projects(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  customer_name text,
  panel_json jsonb NOT NULL,
  docx_storage_path text,
  generated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_facts_generations TO authenticated;
GRANT ALL ON public.supplement_facts_generations TO service_role;

ALTER TABLE public.supplement_facts_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement facts generations"
  ON public.supplement_facts_generations FOR SELECT TO authenticated
  USING (generated_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

CREATE POLICY "Users can insert own supplement facts generations"
  ON public.supplement_facts_generations FOR INSERT TO authenticated
  WITH CHECK (generated_by = auth.uid());

CREATE POLICY "Users can update own supplement facts generations"
  ON public.supplement_facts_generations FOR UPDATE TO authenticated
  USING (generated_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (generated_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own supplement facts generations"
  ON public.supplement_facts_generations FOR DELETE TO authenticated
  USING (generated_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_supp_facts_gen_version ON public.supplement_facts_generations(rd_version_id);
CREATE INDEX idx_supp_facts_gen_user ON public.supplement_facts_generations(generated_by);

CREATE TRIGGER update_supp_facts_gen_updated_at
  BEFORE UPDATE ON public.supplement_facts_generations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();