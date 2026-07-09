-- Create formula_cost_estimates table
CREATE TABLE formula_cost_estimates (
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
ALTER TABLE formula_cost_estimates ENABLE ROW LEVEL SECURITY;

-- Policies: Users can CRUD their own estimates
CREATE POLICY "Users can read own estimates" ON formula_cost_estimates
  FOR SELECT USING (created_by = auth.uid());
  
CREATE POLICY "Users can insert own estimates" ON formula_cost_estimates
  FOR INSERT WITH CHECK (created_by = auth.uid());
  
CREATE POLICY "Users can update own estimates" ON formula_cost_estimates
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  
CREATE POLICY "Users can delete own estimates" ON formula_cost_estimates
  FOR DELETE USING (created_by = auth.uid());

-- Admins can view all estimates
CREATE POLICY "Admins can view all estimates" ON formula_cost_estimates
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for fast lookup
CREATE INDEX idx_formula_cost_estimates_formula ON formula_cost_estimates(formula_id);
CREATE INDEX idx_formula_cost_estimates_user ON formula_cost_estimates(created_by);