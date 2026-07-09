-- Fix the classification_level default value to match check constraint
ALTER TABLE public.formulas 
ALTER COLUMN classification_level SET DEFAULT 'internal';

-- Verify the constraint allows the new default value
-- The constraint should already allow 'internal' as one of the valid values