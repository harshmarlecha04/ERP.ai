
-- Add spec fields to formulas for COA attribute defaults
ALTER TABLE public.formulas
  ADD COLUMN IF NOT EXISTS spec_color_text text,
  ADD COLUMN IF NOT EXISTS spec_shape_text text,
  ADD COLUMN IF NOT EXISTS spec_consistency_text text,
  ADD COLUMN IF NOT EXISTS spec_flavor_text text,
  ADD COLUMN IF NOT EXISTS spec_weight_range_text text,
  ADD COLUMN IF NOT EXISTS spec_foreign_particles_text text DEFAULT 'No visible foreign matter',
  ADD COLUMN IF NOT EXISTS serving_size integer DEFAULT 2;

-- Add automation defaults to coa_settings
ALTER TABLE public.coa_settings
  ADD COLUMN IF NOT EXISTS shelf_life_months integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS active_assay_tolerance_pct numeric NOT NULL DEFAULT 10;

-- Link a generated COA back to the production batch that produced it
ALTER TABLE public.certificates_of_analysis
  ADD COLUMN IF NOT EXISTS production_batch_id uuid
    REFERENCES public.completed_batch_deductions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coa_production_batch
  ON public.certificates_of_analysis(production_batch_id);
