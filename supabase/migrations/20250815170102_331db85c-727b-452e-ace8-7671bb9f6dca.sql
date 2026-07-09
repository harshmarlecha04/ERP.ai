-- Add status column to formulas table
ALTER TABLE public.formulas 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraint to ensure valid status values
ALTER TABLE public.formulas DROP CONSTRAINT IF EXISTS formulas_status_check;
ALTER TABLE public.formulas 
ADD CONSTRAINT formulas_status_check 
CHECK (status IN ('draft', 'active', 'archived'));