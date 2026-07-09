-- Fix inventory threshold trigger function to handle special characters in format strings
CREATE OR REPLACE FUNCTION public.check_inventory_thresholds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    threshold_record RECORD;
    current_quantity NUMERIC;
    alert_severity TEXT;
    alert_message TEXT;
    material_info RECORD;
BEGIN
    -- Get all thresholds for materials that might be affected
    FOR threshold_record IN 
        SELECT it.*, rm.code, rm.name, rm.supplier
        FROM public.inventory_thresholds it
        JOIN public.raw_materials rm ON rm.id = it.raw_material_id
        WHERE it.alert_enabled = true
        AND (
            -- Check if this specific material was affected
            (TG_OP = 'INSERT' AND it.raw_material_id = NEW.raw_material_id) OR
            (TG_OP = 'UPDATE' AND it.raw_material_id = NEW.raw_material_id) OR
            (TG_OP = 'DELETE' AND it.raw_material_id = OLD.raw_material_id) OR
            -- For batch operations, check all thresholds
            TG_OP = 'TRUNCATE'
        )
    LOOP
        -- Calculate current total available quantity for this material
        SELECT COALESCE(SUM(quantity - qty_reserved_kg), 0) INTO current_quantity
        FROM public.raw_material_lots
        WHERE raw_material_id = threshold_record.raw_material_id
        AND quantity > qty_reserved_kg;

        -- Determine alert severity and create alert if needed
        IF current_quantity <= (threshold_record.min_quantity_kg * 0.1) THEN
            alert_severity := 'critical';
            -- Use CONCAT instead of format to avoid format specifier issues
            alert_message := CONCAT('CRITICAL: ', threshold_record.name, ' (', threshold_record.code, ') is critically low at ', 
                            ROUND(current_quantity, 2), ' kg (', 
                            ROUND((current_quantity / GREATEST(threshold_record.min_quantity_kg, 0.01)) * 100, 1), '% of minimum threshold)');
        ELSIF current_quantity <= threshold_record.min_quantity_kg THEN
            alert_severity := 'high';
            -- Use CONCAT instead of format to avoid format specifier issues
            alert_message := CONCAT('LOW INVENTORY: ', threshold_record.name, ' (', threshold_record.code, ') is below minimum threshold at ', 
                            ROUND(current_quantity, 2), ' kg (minimum: ', ROUND(threshold_record.min_quantity_kg, 2), ' kg)');
        ELSIF current_quantity <= (threshold_record.min_quantity_kg * 1.2) THEN
            alert_severity := 'medium';
            -- Use CONCAT instead of format to avoid format specifier issues
            alert_message := CONCAT('APPROACHING LOW: ', threshold_record.name, ' (', threshold_record.code, ') is approaching minimum threshold at ', 
                            ROUND(current_quantity, 2), ' kg (minimum: ', ROUND(threshold_record.min_quantity_kg, 2), ' kg)');
        ELSE
            -- Quantity is above threshold, remove any existing low inventory alerts for this material
            DELETE FROM public.security_alerts
            WHERE alert_type = 'low_inventory'
            AND details->>'raw_material_id' = threshold_record.raw_material_id::text
            AND acknowledged = false;
            CONTINUE;
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
                    'triggered_by', TG_OP,
                    'triggered_at', now()
                )
            );
        END IF;
    END LOOP;

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$