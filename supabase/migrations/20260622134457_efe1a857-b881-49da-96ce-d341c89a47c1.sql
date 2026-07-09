ALTER TABLE public.rd_base_template_ingredients
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'inactive_bulk';

ALTER TABLE public.rd_base_template_ingredients
  DROP CONSTRAINT IF EXISTS rd_base_template_ingredients_section_check;

ALTER TABLE public.rd_base_template_ingredients
  ADD CONSTRAINT rd_base_template_ingredients_section_check
  CHECK (section IN ('inactive_bulk','color_flavor','sweetener_masking'));