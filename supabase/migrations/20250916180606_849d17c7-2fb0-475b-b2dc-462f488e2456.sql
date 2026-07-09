-- Create a manual function to check all inventory thresholds and generate alerts
CREATE OR REPLACE FUNCTION public.check_inventory_thresholds_manual()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    threshold_record RECORD;
    current_quantity NUMERIC;
    alert_severity TEXT;
    alert_message TEXT;
    alerts_created INTEGER := 0;
BEGIN
    -- Get all thresholds with materials that are below thresholds
    FOR threshold_record IN 
        WITH material_quantities AS (
            SELECT 
                it.*,
                rm.code, 
                rm.name, 
                rm.supplier,
                COALESCE(SUM(rml.quantity - COALESCE(rml.qty_reserved_kg, 0)), 0) as available_quantity
            FROM public.inventory_thresholds it
            JOIN public.raw_materials rm ON rm.id = it.raw_material_id
            LEFT JOIN public.raw_material_lots rml ON rml.raw_material_id = it.raw_material_id
            WHERE it.alert_enabled = true
            GROUP BY it.id, it.raw_material_id, it.min_quantity_kg, it.reorder_quantity_kg, it.alert_enabled, it.created_by, it.created_at, it.updated_at, rm.code, rm.name, rm.supplier
        )
        SELECT * FROM material_quantities 
        WHERE available_quantity <= min_quantity_kg
    LOOP
        current_quantity := threshold_record.available_quantity;

        -- Determine alert severity and create alert message
        IF current_quantity <= (threshold_record.min_quantity_kg * 0.1) THEN
            alert_severity := 'critical';
            alert_message := CONCAT('CRITICAL: ', threshold_record.name, ' (', threshold_record.code, ') is critically low at ', 
                            ROUND(current_quantity, 2), ' kg (', 
                            ROUND((current_quantity / GREATEST(threshold_record.min_quantity_kg, 0.01)) * 100, 1), '% of minimum threshold)');
        ELSIF current_quantity <= threshold_record.min_quantity_kg THEN
            alert_severity := 'high';
            alert_message := CONCAT('LOW INVENTORY: ', threshold_record.name, ' (', threshold_record.code, ') is below minimum threshold at ', 
                            ROUND(current_quantity, 2), ' kg (minimum: ', ROUND(threshold_record.min_quantity_kg, 2), ' kg)');
        ELSIF current_quantity <= (threshold_record.min_quantity_kg * 1.2) THEN
            alert_severity := 'medium';
            alert_message := CONCAT('APPROACHING LOW: ', threshold_record.name, ' (', threshold_record.code, ') is approaching minimum threshold at ', 
                            ROUND(current_quantity, 2), ' kg (minimum: ', ROUND(threshold_record.min_quantity_kg, 2), ' kg)');
        END IF;

        -- Check if we already have an unacknowledged alert for this material at this severity
        IF NOT EXISTS (
            SELECT 1 FROM public.security_alerts
            WHERE alert_type = 'low_inventory'
            AND severity = alert_severity
            AND details->>'raw_material_id' = threshold_record.raw_material_id::text
            AND acknowledged = false
        ) THEN
            -- Remove any existing lower-severity alerts for this material
            DELETE FROM public.security_alerts
            WHERE alert_type = 'low_inventory'
            AND details->>'raw_material_id' = threshold_record.raw_material_id::text
            AND acknowledged = false;

            -- Insert new alert
            INSERT INTO public.security_alerts (
                alert_type,
                severity,
                details
            ) VALUES (
                'low_inventory',
                alert_severity,
                jsonb_build_object(
                    'raw_material_id', threshold_record.raw_material_id,
                    'material_code', threshold_record.code,
                    'material_name', threshold_record.name,
                    'supplier', threshold_record.supplier,
                    'current_quantity_kg', current_quantity,
                    'min_quantity_kg', threshold_record.min_quantity_kg,
                    'reorder_quantity_kg', threshold_record.reorder_quantity_kg,
                    'message', alert_message,
                    'triggered_by', 'MANUAL',
                    'triggered_at', now()
                )
            );
            
            alerts_created := alerts_created + 1;
        END IF;
    END LOOP;

    RETURN CONCAT('Created ', alerts_created, ' new inventory alerts');
END;
$function$

-- Run the function to generate missing alerts
SELECT public.check_inventory_thresholds_manual() as result;