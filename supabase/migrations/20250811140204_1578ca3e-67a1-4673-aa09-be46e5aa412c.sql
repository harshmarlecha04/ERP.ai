-- Create formulas and formula_ingredients tables for production scheduling (idempotent)
-- 1) Formulas table
CREATE TABLE IF NOT EXISTS public.formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  default_batch_size_kg numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Open policies (match current project approach)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formulas' AND policyname = 'Anyone can view formulas'
  ) THEN
    CREATE POLICY "Anyone can view formulas" ON public.formulas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formulas' AND policyname = 'Anyone can insert formulas'
  ) THEN
    CREATE POLICY "Anyone can insert formulas" ON public.formulas FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formulas' AND policyname = 'Anyone can update formulas'
  ) THEN
    CREATE POLICY "Anyone can update formulas" ON public.formulas FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formulas' AND policyname = 'Anyone can delete formulas'
  ) THEN
    CREATE POLICY "Anyone can delete formulas" ON public.formulas FOR DELETE USING (true);
  END IF;
END $$;

-- Timestamp trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_formulas_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_formulas_updated_at
    BEFORE UPDATE ON public.formulas
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Formula ingredients table
CREATE TABLE IF NOT EXISTS public.formula_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL,
  raw_material_id uuid NOT NULL,
  percentage numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure foreign keys exist if table already present
DO $$ BEGIN
  -- formula_id -> formulas(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'formula_ingredients' AND c.conname = 'formula_ingredients_formula_id_fkey'
  ) THEN
    ALTER TABLE public.formula_ingredients
    ADD CONSTRAINT formula_ingredients_formula_id_fkey
    FOREIGN KEY (formula_id) REFERENCES public.formulas(id) ON DELETE CASCADE;
  END IF;

  -- raw_material_id -> raw_materials(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'formula_ingredients' AND c.conname = 'formula_ingredients_raw_material_id_fkey'
  ) THEN
    ALTER TABLE public.formula_ingredients
    ADD CONSTRAINT formula_ingredients_raw_material_id_fkey
    FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE public.formula_ingredients ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Open policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formula_ingredients' AND policyname = 'Anyone can view formula ingredients'
  ) THEN
    CREATE POLICY "Anyone can view formula ingredients" ON public.formula_ingredients FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formula_ingredients' AND policyname = 'Anyone can insert formula ingredients'
  ) THEN
    CREATE POLICY "Anyone can insert formula ingredients" ON public.formula_ingredients FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formula_ingredients' AND policyname = 'Anyone can update formula ingredients'
  ) THEN
    CREATE POLICY "Anyone can update formula ingredients" ON public.formula_ingredients FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'formula_ingredients' AND policyname = 'Anyone can delete formula ingredients'
  ) THEN
    CREATE POLICY "Anyone can delete formula ingredients" ON public.formula_ingredients FOR DELETE USING (true);
  END IF;
END $$;

-- Timestamp trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_formula_ingredients_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_formula_ingredients_updated_at
    BEFORE UPDATE ON public.formula_ingredients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_formulas_code ON public.formulas (code);
CREATE INDEX IF NOT EXISTS idx_formula_ingredients_formula_id ON public.formula_ingredients (formula_id);
CREATE INDEX IF NOT EXISTS idx_formula_ingredients_raw_material_id ON public.formula_ingredients (raw_material_id);
