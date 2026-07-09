-- Create formula_cost_estimates table
CREATE TABLE IF NOT EXISTS formula_cost_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  estimate_name text NOT NULL,
  batches numeric NOT NULL DEFAULT 1,
  rm_lines jsonb NOT NULL DEFAULT '[]',
  labor_manufacturing jsonb NOT NULL DEFAULT '[]',
  labor_coating jsonb NOT NULL DEFAULT '[]',
  labor_packaging jsonb NOT NULL DEFAULT '[]',
  utilities_mode text NOT NULL DEFAULT 'percent' CHECK (utilities_mode IN ('percent', 'manual')),
  utilities_value jsonb NOT NULL DEFAULT '{"percent": 5}',
  totals jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
DO $rls$ BEGIN ALTER TABLE formula_cost_estimates ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Policies: Users can CRUD their own estimates
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can read own estimates" ON formula_cost_estimates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can read own estimates" ON formula_cost_estimates
  FOR SELECT USING (created_by = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can insert own estimates" ON formula_cost_estimates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can insert own estimates" ON formula_cost_estimates
  FOR INSERT WITH CHECK (created_by = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update own estimates" ON formula_cost_estimates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can update own estimates" ON formula_cost_estimates
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete own estimates" ON formula_cost_estimates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete own estimates" ON formula_cost_estimates
  FOR DELETE USING (created_by = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Admins can view all estimates
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all estimates" ON formula_cost_estimates; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view all estimates" ON formula_cost_estimates
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_formula_cost_estimates_formula ON formula_cost_estimates(formula_id);
CREATE INDEX IF NOT EXISTS idx_formula_cost_estimates_user ON formula_cost_estimates(created_by);