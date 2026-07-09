-- Fix the formula requirements function to handle the correct JSON structure
DROP FUNCTION IF EXISTS public.fn_formula_requirements(uuid, integer);

CREATE OR REPLACE FUNCTION public.fn_formula_requirements(p_formula_id uuid, p_batches integer)
RETURNS TABLE(ingredient_id uuid, ingredient_name text, required_kg numeric)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    rm.id as ingredient_id,
    rm.name as ingredient_name,
    (
      CASE 
        WHEN rec.weightKg IS NOT NULL THEN rec.weightKg::numeric * p_batches
        WHEN rec.qty_per_batch_kg IS NOT NULL THEN rec.qty_per_batch_kg::numeric * p_batches
        ELSE 0::numeric
      END
    ) as required_kg
  FROM (
    SELECT * FROM jsonb_to_recordset(
      COALESCE((SELECT recipe_json FROM public.formulas f WHERE f.id = p_formula_id), '[]'::jsonb)
    ) AS x(materialName text, weightKg numeric, qty_per_batch_kg numeric)
  ) rec
  JOIN public.raw_materials rm ON LOWER(rm.name) = LOWER(rec.materialName)
  WHERE rec.materialName IS NOT NULL 
    AND (rec.weightKg IS NOT NULL AND rec.weightKg > 0 OR rec.qty_per_batch_kg IS NOT NULL AND rec.qty_per_batch_kg > 0);
END;
$function$;