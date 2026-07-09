-- Fix calculate_max_batches to show ALL ingredients from formula, not just those with inventory matches
CREATE OR REPLACE FUNCTION public.calculate_max_batches(p_formula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_formula_recipe jsonb;
    v_ingredient jsonb;
    v_ingredient_name text;
    v_material_id uuid;
    v_required_qty numeric;
    v_available_qty numeric;
    v_max_batches_from_ingredient integer;
    v_min_batches integer := 2147483647; -- Start with max integer
    v_limiting_ingredient jsonb := NULL;
    v_ingredient_details jsonb := '[]'::jsonb;
    v_has_sufficient boolean := true;
BEGIN
    -- Get formula recipe
    SELECT recipe_json INTO v_formula_recipe
    FROM public.formulas 
    WHERE id = p_formula_id AND NOT is_deleted;
    
    IF v_formula_recipe IS NULL THEN
        RETURN jsonb_build_object(
            'max_batches', 0,
            'limiting_ingredient', NULL,
            'ingredient_details', '[]'::jsonb,
            'has_sufficient_inventory', false
        );
    END IF;
    
    -- Process each ingredient in the recipe
    FOR v_ingredient IN SELECT * FROM jsonb_array_elements(v_formula_recipe)
    LOOP
        -- Extract ingredient information
        v_ingredient_name := v_ingredient->>'materialName';
        v_required_qty := COALESCE((v_ingredient->>'weightKg')::numeric, 0);
        
        -- Skip if no ingredient name or zero quantity
        CONTINUE WHEN v_ingredient_name IS NULL OR v_required_qty <= 0;
        
        -- Find raw material by name (case-insensitive)
        SELECT id INTO v_material_id
        FROM public.raw_materials
        WHERE LOWER(name) = LOWER(v_ingredient_name)
        LIMIT 1;
        
        -- Calculate available quantity (0 if no matching material found)
        IF v_material_id IS NOT NULL THEN
            SELECT COALESCE(SUM(quantity), 0) INTO v_available_qty
            FROM public.raw_material_lots 
            WHERE raw_material_id = v_material_id;
        ELSE
            v_available_qty := 0;
        END IF;
        
        -- Calculate max batches possible from this ingredient
        IF v_required_qty > 0 THEN
            v_max_batches_from_ingredient := FLOOR(v_available_qty / v_required_qty);
        ELSE
            v_max_batches_from_ingredient := 0;
        END IF;
        
        -- Track the limiting ingredient (ingredient that allows fewest batches)
        IF v_max_batches_from_ingredient < v_min_batches THEN
            v_min_batches := v_max_batches_from_ingredient;
            v_limiting_ingredient := jsonb_build_object(
                'ingredient_id', COALESCE(v_material_id::text, ''),
                'ingredient_name', v_ingredient_name,
                'available_kg', v_available_qty,
                'required_per_batch_kg', v_required_qty,
                'max_batches', v_max_batches_from_ingredient
            );
        END IF;
        
        -- Add to ingredient details (show ALL ingredients from formula)
        v_ingredient_details := v_ingredient_details || jsonb_build_array(
            jsonb_build_object(
                'ingredient_id', COALESCE(v_material_id::text, ''),
                'ingredient_name', v_ingredient_name,
                'available_kg', v_available_qty,
                'required_per_batch_kg', v_required_qty,
                'max_batches_from_ingredient', v_max_batches_from_ingredient,
                'has_inventory_match', (v_material_id IS NOT NULL)
            )
        );
        
        -- Check if we have sufficient inventory
        IF v_max_batches_from_ingredient = 0 THEN
            v_has_sufficient := false;
        END IF;
    END LOOP;
    
    -- If no ingredients processed, return 0
    IF v_min_batches = 2147483647 THEN
        v_min_batches := 0;
    END IF;
    
    RETURN jsonb_build_object(
        'max_batches', v_min_batches,
        'limiting_ingredient', v_limiting_ingredient,
        'ingredient_details', v_ingredient_details,
        'has_sufficient_inventory', v_has_sufficient
    );
END;
$function$;