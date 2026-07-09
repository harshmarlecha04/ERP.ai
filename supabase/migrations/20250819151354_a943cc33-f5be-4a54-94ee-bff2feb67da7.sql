-- Fix the get_formula_ingredients_with_lots function
CREATE OR REPLACE FUNCTION public.get_formula_ingredients_with_lots(p_formula_id UUID, p_batches INTEGER)
RETURNS TABLE(
  ingredient_id UUID,
  ingredient_name TEXT,
  ingredient_code TEXT,
  required_quantity_kg NUMERIC,
  available_lots JSONB
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  req record;
  lots_data jsonb;
  ingredient_code_val text;
BEGIN
  -- Loop through formula requirements
  FOR req IN SELECT * FROM public.fn_formula_requirements(p_formula_id, p_batches) LOOP
    -- Get available lots for this ingredient with proper ordering
    SELECT jsonb_agg(lot_data ORDER BY lot_data->>'receiving_date', lot_data->>'created_at') INTO lots_data
    FROM (
      SELECT jsonb_build_object(
        'id', rml.id,
        'lot_number', rml.lot_number,
        'supplier', rm.supplier,
        'quantity', rml.quantity,
        'qty_reserved_kg', rml.qty_reserved_kg,
        'available_qty', (rml.quantity - rml.qty_reserved_kg),
        'receiving_date', rml.receiving_date,
        'expires_on', rml.expires_on,
        'cost', rml.cost,
        'created_at', rml.created_at
      ) as lot_data
      FROM public.raw_material_lots rml
      JOIN public.raw_materials rm ON rm.id = rml.raw_material_id
      WHERE rml.raw_material_id = req.ingredient_id
      AND (rml.quantity - rml.qty_reserved_kg) > 0
    ) subquery;
    
    -- Get ingredient code
    SELECT rm.code INTO ingredient_code_val
    FROM public.raw_materials rm
    WHERE rm.id = req.ingredient_id;
    
    RETURN QUERY SELECT 
      req.ingredient_id,
      req.ingredient_name,
      COALESCE(ingredient_code_val, ''),
      req.required_kg,
      COALESCE(lots_data, '[]'::jsonb);
  END LOOP;
END;
$$;