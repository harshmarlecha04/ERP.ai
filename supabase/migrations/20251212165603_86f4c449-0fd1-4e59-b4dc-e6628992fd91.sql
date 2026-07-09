-- Add is_default boolean column to formula_cost_estimates
ALTER TABLE formula_cost_estimates 
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Create unique partial index: only 1 default per formula per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_cost_per_formula_user
ON formula_cost_estimates(formula_id, created_by)
WHERE is_default = true;