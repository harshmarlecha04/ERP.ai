-- Fix material name mismatches in formula recipe_json
-- This updates 17 ingredient names to match their exact raw_materials names

UPDATE public.formulas 
SET 
  recipe_json = (
    SELECT jsonb_agg(
      CASE 
        -- Priority fixes (most formulas affected)
        WHEN elem->>'materialName' = 'Melatonin' 
          THEN jsonb_set(elem, '{materialName}', '"Melatonin - PureAssay"')
        WHEN elem->>'materialName' = 'Tapioca Syrup' 
          THEN jsonb_set(elem, '{materialName}', '"Tapioca Organic Syrup - Malt"')
        WHEN elem->>'materialName' = 'Gelymar' 
          THEN jsonb_set(elem, '{materialName}', '"CarraGel PFP 6825 - Gelymar"')
        WHEN elem->>'materialName' = 'Organic Cane Sugar' 
          THEN jsonb_set(elem, '{materialName}', '"Organic Cane Sugar - DW Montgomery"')
        WHEN elem->>'materialName' = 'Tri Sodium Citrate' 
          THEN jsonb_set(elem, '{materialName}', '"Tri Sodium Citrate - JBC"')
        WHEN elem->>'materialName' = 'Red Color' 
          THEN jsonb_set(elem, '{materialName}', '"Red Color - LorAnn"')
        WHEN elem->>'materialName' = 'L-Theanine' 
          THEN jsonb_set(elem, '{materialName}', '"L-Theanine - PureAssay"')
        WHEN elem->>'materialName' = 'Magnesium Glycinate 11%' 
          THEN jsonb_set(elem, '{materialName}', '"Magnesium Glycinate 11% - PureAssay"')
        WHEN elem->>'materialName' = 'Sucralose' 
          THEN jsonb_set(elem, '{materialName}', '"Sucralose - JHD"')
        WHEN elem->>'materialName' = 'Wild berry Flavor' 
          THEN jsonb_set(elem, '{materialName}', '"Wild berry Flavor - Gold Coast"')
        WHEN elem->>'materialName' = 'Irish Moss Extract' 
          THEN jsonb_set(elem, '{materialName}', '"Irish Moss Extract - JHD"')
        WHEN elem->>'materialName' = 'B5 - PureAssay' 
          THEN jsonb_set(elem, '{materialName}', '"Pantothenic Acid B5 - PureAssay"')
        WHEN elem->>'materialName' = 'Beta Carotene - PureAssay' 
          THEN jsonb_set(elem, '{materialName}', '"Vitamin A - Beta Carotene - PureAssay"')
        WHEN elem->>'materialName' = 'D-Alpha Tocopheryl Acetate' 
          THEN jsonb_set(elem, '{materialName}', '"D-Alpha Tocopheryl Acetate - Vitamin E"')
        WHEN elem->>'materialName' = 'Methylcobalamin Pure' 
          THEN jsonb_set(elem, '{materialName}', '"Methylcobalamin Pure B12"')
        WHEN elem->>'materialName' = 'Mixed Berry Flavor' 
          THEN jsonb_set(elem, '{materialName}', '"Mixed Berry Flavor - Lucta"')
        WHEN elem->>'materialName' = 'N Beta Carotene - Yellow' 
          THEN jsonb_set(elem, '{materialName}', '"N Beta Carotene - Yellow - DDW"')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(recipe_json) elem
  ),
  updated_at = now()
WHERE recipe_json IS NOT NULL
  AND NOT is_deleted
  AND (
    recipe_json::text LIKE '%"Melatonin"%' OR
    recipe_json::text LIKE '%"Tapioca Syrup"%' OR
    recipe_json::text LIKE '%"Gelymar"%' OR
    recipe_json::text LIKE '%"Organic Cane Sugar"%' OR
    recipe_json::text LIKE '%"Tri Sodium Citrate"%' OR
    recipe_json::text LIKE '%"Red Color"%' OR
    recipe_json::text LIKE '%"L-Theanine"%' OR
    recipe_json::text LIKE '%"Magnesium Glycinate 11%"%' OR
    recipe_json::text LIKE '%"Sucralose"%' OR
    recipe_json::text LIKE '%"Wild berry Flavor"%' OR
    recipe_json::text LIKE '%"Irish Moss Extract"%' OR
    recipe_json::text LIKE '%"B5 - PureAssay"%' OR
    recipe_json::text LIKE '%"Beta Carotene - PureAssay"%' OR
    recipe_json::text LIKE '%"D-Alpha Tocopheryl Acetate"%' OR
    recipe_json::text LIKE '%"Methylcobalamin Pure"%' OR
    recipe_json::text LIKE '%"Mixed Berry Flavor"%' OR
    recipe_json::text LIKE '%"N Beta Carotene - Yellow"%'
  );

-- Verification: Check for any remaining mismatches
-- This should return 0 rows after the migration
DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT COUNT(DISTINCT elem->>'materialName') INTO mismatch_count
  FROM public.formulas f,
       jsonb_array_elements(f.recipe_json) elem
  WHERE NOT f.is_deleted
    AND elem->>'materialName' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.raw_materials rm 
      WHERE LOWER(rm.name) = LOWER(elem->>'materialName')
        AND NOT rm.is_archived
    );
  
  IF mismatch_count > 0 THEN
    RAISE NOTICE 'WARNING: % ingredient mismatches still remain after migration', mismatch_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All ingredient names now match raw_materials exactly';
  END IF;
END $$;