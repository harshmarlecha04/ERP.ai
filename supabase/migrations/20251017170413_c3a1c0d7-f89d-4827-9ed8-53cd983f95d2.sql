-- Fix formula recipes to use correct material names that exist in raw_materials table

-- Update GG006 - 158: Change "Bittermasking Agent" to "Bitter Masking (MA-19858) - Tierra"
UPDATE public.formulas
SET recipe_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'materialName' = 'Bittermasking Agent' THEN
        jsonb_set(elem, '{materialName}', '"Bitter Masking (MA-19858) - Tierra"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(recipe_json) elem
)
WHERE code = 'GG006 - 158';

-- Update GG005 - V1: Change "Bittermasking Agent" to "Bitter Masking (MA-19858) - Tierra"
UPDATE public.formulas
SET recipe_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'materialName' = 'Bittermasking Agent' THEN
        jsonb_set(elem, '{materialName}', '"Bitter Masking (MA-19858) - Tierra"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(recipe_json) elem
)
WHERE code = 'GG005 - V1';

-- Also fix "Watermelon Flavor - LorAnn" to "Watermelon Flavor - Lucta" in GG006-158 if needed
UPDATE public.formulas
SET recipe_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'materialName' = 'Watermelon Flavor - LorAnn' THEN
        jsonb_set(elem, '{materialName}', '"Watermelon Flavor - Lucta"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(recipe_json) elem
)
WHERE code = 'GG006 - 158';