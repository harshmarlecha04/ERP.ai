-- Create production_ingredient_usage table to track actual materials used per batch
CREATE TABLE public.production_ingredient_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_item_id UUID NOT NULL,
  raw_material_id UUID NOT NULL,
  lot_id UUID,
  supplier_name TEXT NOT NULL,
  lot_number TEXT,
  required_quantity_kg NUMERIC NOT NULL DEFAULT 0,
  actual_quantity_kg NUMERIC NOT NULL DEFAULT 0,
  batches_used INTEGER NOT NULL DEFAULT 0,
  usage_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.production_ingredient_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for production ingredient usage
CREATE POLICY "Only admins and production managers can manage ingredient usage" 
ON public.production_ingredient_usage 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role));

-- Create function to get formula ingredients with available lots
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
BEGIN
  -- Loop through formula requirements
  FOR req IN SELECT * FROM public.fn_formula_requirements(p_formula_id, p_batches) LOOP
    -- Get available lots for this ingredient
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', rml.id,
        'lot_number', rml.lot_number,
        'supplier', rm.supplier,
        'quantity', rml.quantity,
        'qty_reserved_kg', rml.qty_reserved_kg,
        'available_qty', (rml.quantity - rml.qty_reserved_kg),
        'receiving_date', rml.receiving_date,
        'expires_on', rml.expires_on,
        'cost', rml.cost
      )
    ) INTO lots_data
    FROM public.raw_material_lots rml
    JOIN public.raw_materials rm ON rm.id = rml.raw_material_id
    WHERE rml.raw_material_id = req.ingredient_id
    AND (rml.quantity - rml.qty_reserved_kg) > 0
    ORDER BY rml.receiving_date ASC, rml.created_at ASC;
    
    -- Get ingredient details
    SELECT rm.code INTO ingredient_code
    FROM public.raw_materials rm
    WHERE rm.id = req.ingredient_id;
    
    RETURN QUERY SELECT 
      req.ingredient_id,
      req.ingredient_name,
      COALESCE(ingredient_code, ''),
      req.required_kg,
      COALESCE(lots_data, '[]'::jsonb);
  END LOOP;
END;
$$;

-- Create function to save production ingredient usage
CREATE OR REPLACE FUNCTION public.save_production_ingredient_usage(
  p_schedule_item_id UUID,
  p_usage_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  usage_record jsonb;
  result jsonb := '{"success": true, "message": "Production ingredients saved successfully"}'::jsonb;
BEGIN
  -- Validate user permissions
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)) THEN
    RETURN '{"success": false, "error": "Insufficient permissions"}'::jsonb;
  END IF;
  
  -- Delete existing usage records for this schedule item
  DELETE FROM public.production_ingredient_usage 
  WHERE schedule_item_id = p_schedule_item_id;
  
  -- Insert new usage records
  FOR usage_record IN SELECT * FROM jsonb_array_elements(p_usage_data)
  LOOP
    INSERT INTO public.production_ingredient_usage (
      schedule_item_id,
      raw_material_id,
      lot_id,
      supplier_name,
      lot_number,
      required_quantity_kg,
      actual_quantity_kg,
      batches_used,
      created_by
    ) VALUES (
      p_schedule_item_id,
      (usage_record->>'raw_material_id')::UUID,
      NULLIF(usage_record->>'lot_id', '')::UUID,
      usage_record->>'supplier_name',
      usage_record->>'lot_number',
      (usage_record->>'required_quantity_kg')::NUMERIC,
      (usage_record->>'actual_quantity_kg')::NUMERIC,
      (usage_record->>'batches_used')::INTEGER,
      auth.uid()
    );
  END LOOP;
  
  RETURN result;
END;
$$;