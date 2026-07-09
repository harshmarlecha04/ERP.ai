
-- 1) Templates
CREATE TABLE public.rd_base_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mold_size text,
  default_piece_weight_g numeric(6,3) NOT NULL DEFAULT 3.5,
  default_batch_weight_g numeric(8,2) NOT NULL DEFAULT 500,
  cook_temp_c numeric(5,1) DEFAULT 100,
  brix_target numeric(5,2) DEFAULT 67,
  add_active_temp_c numeric(5,1) DEFAULT 90,
  tri_sodium_citrate_temp_c numeric(5,1) DEFAULT 80,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_base_templates TO authenticated;
GRANT ALL ON public.rd_base_templates TO service_role;
ALTER TABLE public.rd_base_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read rd_base_templates" ON public.rd_base_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert rd_base_templates" ON public.rd_base_templates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update rd_base_templates" ON public.rd_base_templates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete rd_base_templates" ON public.rd_base_templates
  FOR DELETE TO authenticated USING (true);

-- 2) Ingredients
CREATE TABLE public.rd_base_template_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.rd_base_templates(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  supplier text,
  default_percent numeric(8,4) NOT NULL DEFAULT 0,
  highlight_color text DEFAULT 'none',
  role text DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rd_base_template_ing_template ON public.rd_base_template_ingredients(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_base_template_ingredients TO authenticated;
GRANT ALL ON public.rd_base_template_ingredients TO service_role;
ALTER TABLE public.rd_base_template_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read rd_base_template_ingredients" ON public.rd_base_template_ingredients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert rd_base_template_ingredients" ON public.rd_base_template_ingredients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update rd_base_template_ingredients" ON public.rd_base_template_ingredients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete rd_base_template_ingredients" ON public.rd_base_template_ingredients
  FOR DELETE TO authenticated USING (true);

-- 3) Steps
CREATE TABLE public.rd_base_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.rd_base_templates(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rd_base_template_steps_template ON public.rd_base_template_steps(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_base_template_steps TO authenticated;
GRANT ALL ON public.rd_base_template_steps TO service_role;
ALTER TABLE public.rd_base_template_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read rd_base_template_steps" ON public.rd_base_template_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert rd_base_template_steps" ON public.rd_base_template_steps
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update rd_base_template_steps" ON public.rd_base_template_steps
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete rd_base_template_steps" ON public.rd_base_template_steps
  FOR DELETE TO authenticated USING (true);

-- 4) Updated_at trigger on templates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_rd_base_templates_updated
  BEFORE UPDATE ON public.rd_base_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Add columns to rd_project_versions
ALTER TABLE public.rd_project_versions
  ADD COLUMN IF NOT EXISTS base_template_id uuid REFERENCES public.rd_base_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS piece_weight_g numeric(6,3),
  ADD COLUMN IF NOT EXISTS active_overage_percent jsonb;

-- 6) Seed a starter template
DO $$
DECLARE
  t_id uuid;
BEGIN
  INSERT INTO public.rd_base_templates(name, mold_size, default_piece_weight_g, default_batch_weight_g,
    cook_temp_c, brix_target, add_active_temp_c, tri_sodium_citrate_temp_c)
  VALUES ('Standard Pectin/Carrageenan – Button Fly 3.5g', 'Button Fly Molds', 3.5, 500, 100, 67, 90, 80)
  RETURNING id INTO t_id;

  INSERT INTO public.rd_base_template_ingredients(template_id, sort_order, name, supplier, default_percent, highlight_color, role) VALUES
    (t_id, 1, 'Organic Tapioca Syrup 42 DE', 'CIRANDA', 35.43, 'none', 'syrup'),
    (t_id, 2, 'Organic Cane Sugar', 'JALLES MACHADO S/A', 34.55, 'none', 'sugar'),
    (t_id, 3, 'Purified Water', NULL, 25.51, 'none', 'water'),
    (t_id, 4, 'Carrageenan', 'GELYMAR', 1.28, 'green', 'gelling'),
    (t_id, 5, 'Pectin', 'PACIFIC YSC', 0.20, 'green', 'gelling'),
    (t_id, 6, 'Tri Sodium Citrate', 'JUNGBUNZLAUER', 0.27, 'none', 'acid'),
    (t_id, 7, 'Citric Acid Anhydrous', 'CARGILL', 0.30, 'none', 'acid'),
    (t_id, 8, 'N&A Strawberry Flavor # 241Z20', 'LUCTA', 1.50, 'yellow', 'flavor'),
    (t_id, 9, 'ART Red Color # 1783N', 'COLORCON', 0.09, 'none', 'color'),
    (t_id, 10, 'Sucralose Sweetener', 'ANHUE JinHe Industrial', 0.021, 'none', 'sweetener'),
    (t_id, 11, 'Licorice Root Extract', 'Bulk Naturals', 0.71, 'none', 'other');

  INSERT INTO public.rd_base_template_steps(template_id, step_number, text) VALUES
    (t_id, 1, 'Set Cooker temperature at {cook_temp} °C, add Water, bring it to boiling point'),
    (t_id, 2, 'Add Carrageenan & Pectin Powders into Cooker, mix well until all lumps dissolved'),
    (t_id, 3, 'Add Organic Tapioca Syrup 42 DE into Cooker, mix well'),
    (t_id, 4, 'Slowly add Organic Cane Sugar, continue to mix'),
    (t_id, 5, 'Add Tri Sodium Citrate at {tri_sodium_citrate_temp} °C, mix well'),
    (t_id, 6, 'Cook Candy mass to 85 °C until Brix reaches {brix} % Solid'),
    (t_id, 7, 'Reduce Cooker temp to {add_active_temp} °C, then add ACTIVE + Remaining ingredients, mix well'),
    (t_id, 8, 'Transfer Candy mass into hot funnel, BEGIN DEPOSITING');
END $$;
