-- Check if formulas table needs updates for proper formula management
-- This ensures formulas can be saved with ingredients as a transaction

-- Add missing columns to formulas table if needed
DO $$ 
BEGIN
  -- Add version column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'version') THEN
    ALTER TABLE public.formulas ADD COLUMN version text DEFAULT '1.0';
  END IF;
  
  -- Add yield_uom column if it doesn't exist  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'yield_uom') THEN
    ALTER TABLE public.formulas ADD COLUMN yield_uom text DEFAULT 'kg';
  END IF;
  
  -- Add notes column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'notes') THEN
    ALTER TABLE public.formulas ADD COLUMN notes text;
  END IF;
  
  -- Add is_deleted column if it doesn't exist (soft delete)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'is_deleted') THEN
    ALTER TABLE public.formulas ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;
  
  -- Add product_code_line column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'product_code_line') THEN
    ALTER TABLE public.formulas ADD COLUMN product_code_line text;
  END IF;
  
  -- Add average_piece_weight column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'average_piece_weight') THEN
    ALTER TABLE public.formulas ADD COLUMN average_piece_weight numeric DEFAULT 0;
  END IF;
  
  -- Add total_pieces column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'total_pieces') THEN
    ALTER TABLE public.formulas ADD COLUMN total_pieces integer DEFAULT 0;
  END IF;
  
  -- Add procedure_text column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'procedure_text') THEN
    ALTER TABLE public.formulas ADD COLUMN procedure_text text;
  END IF;
  
  -- Add active_ingredients_json column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'formulas' AND column_name = 'active_ingredients_json') THEN
    ALTER TABLE public.formulas ADD COLUMN active_ingredients_json jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index on is_deleted for performance
CREATE INDEX IF NOT EXISTS idx_formulas_not_deleted ON public.formulas (is_deleted) WHERE is_deleted = false;

-- Create index for product code searches
CREATE INDEX IF NOT EXISTS idx_formulas_product_code ON public.formulas (code) WHERE is_deleted = false;