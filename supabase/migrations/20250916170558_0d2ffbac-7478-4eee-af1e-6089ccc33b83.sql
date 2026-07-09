-- Fix the ambiguous column reference in get_inventory_status_with_thresholds function
CREATE OR REPLACE FUNCTION public.get_inventory_status_with_thresholds()
 RETURNS TABLE(raw_material_id uuid, material_code text, material_name text, supplier text, current_quantity_kg numeric, min_quantity_kg numeric, reorder_quantity_kg numeric, alert_enabled boolean, status text, percentage_of_minimum numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        rm.id as raw_material_id,
        rm.code as material_code,
        rm.name as material_name,
        rm.supplier,
        COALESCE(lots.total_available, 0) as current_quantity_kg,
        COALESCE(it.min_quantity_kg, 0) as min_quantity_kg,
        COALESCE(it.reorder_quantity_kg, 0) as reorder_quantity_kg,
        COALESCE(it.alert_enabled, false) as alert_enabled,
        CASE 
            WHEN it.min_quantity_kg IS NULL THEN 'no_threshold'
            WHEN COALESCE(lots.total_available, 0) <= (it.min_quantity_kg * 0.1) THEN 'critical'
            WHEN COALESCE(lots.total_available, 0) <= it.min_quantity_kg THEN 'low'
            WHEN COALESCE(lots.total_available, 0) <= (it.min_quantity_kg * 1.2) THEN 'approaching_low'
            ELSE 'good'
        END as status,
        CASE 
            WHEN it.min_quantity_kg > 0 THEN (COALESCE(lots.total_available, 0) / it.min_quantity_kg) * 100
            ELSE NULL
        END as percentage_of_minimum
    FROM public.raw_materials rm
    LEFT JOIN public.inventory_thresholds it ON it.raw_material_id = rm.id
    LEFT JOIN (
        SELECT 
            rml.raw_material_id,
            SUM(rml.quantity - rml.qty_reserved_kg) as total_available
        FROM public.raw_material_lots rml
        WHERE rml.quantity > rml.qty_reserved_kg
        GROUP BY rml.raw_material_id
    ) lots ON lots.raw_material_id = rm.id
    WHERE NOT rm.is_archived
    ORDER BY 
        CASE 
            WHEN it.min_quantity_kg IS NULL THEN 'no_threshold'
            WHEN COALESCE(lots.total_available, 0) <= (it.min_quantity_kg * 0.1) THEN 'critical'
            WHEN COALESCE(lots.total_available, 0) <= it.min_quantity_kg THEN 'low'
            WHEN COALESCE(lots.total_available, 0) <= (it.min_quantity_kg * 1.2) THEN 'approaching_low'
            ELSE 'good'
        END,
        rm.code;
END;
$function$;