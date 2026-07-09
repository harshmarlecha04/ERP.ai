-- Fix ambiguous column reference in get_material_requirements_by_date_range
DROP FUNCTION IF EXISTS get_material_requirements_by_date_range(date, date);

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_material_requirements_by_date_range' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION get_material_requirements_by_date_range(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    raw_material_id UUID,
    material_code TEXT,
    material_name TEXT,
    supplier TEXT,
    uom TEXT,
    total_required_kg NUMERIC,
    current_inventory_kg NUMERIC,
    reserved_kg NUMERIC,
    available_kg NUMERIC,
    on_order_kg NUMERIC,
    net_shortage_kg NUMERIC,
    net_after_orders_kg NUMERIC,
    formulas_using JSONB,
    schedule_dates TEXT[],
    pending_po_numbers TEXT[],
    pending_po_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH aggregated_requirements AS (
        SELECT 
            rm.id as raw_material_id,
            rm.code as material_code,
            rm.name as material_name,
            rm.supplier,
            rm.uom,
            SUM(
                (recipe_item->>'weightKg')::NUMERIC * psi.batches
            ) as total_required_kg,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'formula_code', f.code,
                    'formula_name', f.name,
                    'batches', psi.batches
                )
            ) as formulas_using,
            ARRAY_AGG(DISTINCT ps.schedule_date::TEXT) as schedule_dates
        FROM production_schedule_items psi
        JOIN production_schedules ps ON ps.id = psi.schedule_id
        JOIN formulas f ON f.id = psi.formula_id
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(f.recipe_json) as recipe_item
        JOIN raw_materials rm ON LOWER(rm.name) = LOWER(recipe_item->>'materialName')
        WHERE ps.schedule_date BETWEEN p_start_date AND p_end_date
            AND NOT f.is_deleted
        GROUP BY rm.id, rm.code, rm.name, rm.supplier, rm.uom
    ),
    inventory_status AS (
        SELECT 
            rm.id as material_id,
            COALESCE(SUM(rml.quantity), 0) as current_inventory_kg,
            COALESCE(SUM(rml.qty_reserved_kg), 0) as reserved_kg
        FROM raw_materials rm
        LEFT JOIN raw_material_lots rml ON rml.raw_material_id = rm.id
        GROUP BY rm.id
    ),
    purchase_orders_summary AS (
        SELECT 
            rm.id as material_id,
            COALESCE(SUM(po.quantity), 0) as on_order_kg,
            ARRAY_AGG(po.po_number) FILTER (WHERE po.status = 'ordered') as pending_po_numbers,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'po_number', po.po_number,
                    'expected_delivery', po.expected_delivery
                )
            ) FILTER (WHERE po.status = 'ordered') as pending_po_details
        FROM raw_materials rm
        LEFT JOIN purchase_orders po ON po.ingredient_id = rm.id AND po.status = 'ordered'
        GROUP BY rm.id
    )
    SELECT 
        ar.raw_material_id,
        ar.material_code,
        ar.material_name,
        ar.supplier,
        ar.uom,
        ar.total_required_kg,
        COALESCE(inv.current_inventory_kg, 0) as current_inventory_kg,
        COALESCE(inv.reserved_kg, 0) as reserved_kg,
        COALESCE(inv.current_inventory_kg - inv.reserved_kg, 0) as available_kg,
        COALESCE(po.on_order_kg, 0) as on_order_kg,
        GREATEST(ar.total_required_kg - COALESCE(inv.current_inventory_kg - inv.reserved_kg, 0), 0) as net_shortage_kg,
        COALESCE(inv.current_inventory_kg - inv.reserved_kg, 0) + COALESCE(po.on_order_kg, 0) - ar.total_required_kg as net_after_orders_kg,
        ar.formulas_using,
        ar.schedule_dates,
        COALESCE(po.pending_po_numbers, ARRAY[]::TEXT[]) as pending_po_numbers,
        COALESCE(po.pending_po_details, '[]'::JSONB) as pending_po_details
    FROM aggregated_requirements ar
    LEFT JOIN inventory_status inv ON inv.material_id = ar.raw_material_id
    LEFT JOIN purchase_orders_summary po ON po.material_id = ar.raw_material_id
    ORDER BY ar.material_name;
END;
$$;