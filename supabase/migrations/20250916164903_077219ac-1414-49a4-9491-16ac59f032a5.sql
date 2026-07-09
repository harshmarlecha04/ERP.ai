-- Create inventory thresholds table
CREATE TABLE IF NOT EXISTS public.inventory_thresholds (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    min_quantity_kg NUMERIC NOT NULL DEFAULT 0,
    reorder_quantity_kg NUMERIC NOT NULL DEFAULT 0,
    alert_enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(raw_material_id)
);

-- Enable RLS on inventory_thresholds
DO $rls$ BEGIN ALTER TABLE public.inventory_thresholds ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS policies for inventory_thresholds
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view inventory thresholds" ON public.inventory_thresholds; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view inventory thresholds"
ON public.inventory_thresholds FOR SELECT
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins and procurement can manage inventory thresholds" ON public.inventory_thresholds; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins and procurement can manage inventory thresholds"
ON public.inventory_thresholds FOR ALL
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create function to check inventory levels and create alerts
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_inventory_thresholds' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.check_inventory_thresholds()
RETURNS TRIGGER
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
            alert_message := format('CRITICAL: %s (%s) is critically low at %.2f kg (%.1f%% of minimum threshold)',
                threshold_record.name, threshold_record.code, current_quantity, 
                (current_quantity / GREATEST(threshold_record.min_quantity_kg, 0.01)) * 100);
        ELSIF current_quantity <= threshold_record.min_quantity_kg THEN
            alert_severity := 'high';
            alert_message := format('LOW INVENTORY: %s (%s) is below minimum threshold at %.2f kg (minimum: %.2f kg)',
                threshold_record.name, threshold_record.code, current_quantity, threshold_record.min_quantity_kg);
        ELSIF current_quantity <= (threshold_record.min_quantity_kg * 1.2) THEN
            alert_severity := 'medium';
            alert_message := format('APPROACHING LOW: %s (%s) is approaching minimum threshold at %.2f kg (minimum: %.2f kg)',
                threshold_record.name, threshold_record.code, current_quantity, threshold_record.min_quantity_kg);
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
DO $aud$ BEGIN INSERT INTO public.security_alerts (
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
            ); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
        END IF;
    END LOOP;

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

-- Create trigger on raw_material_lots table
DROP TRIGGER IF EXISTS inventory_threshold_check_trigger ON public.raw_material_lots;
CREATE TRIGGER inventory_threshold_check_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.raw_material_lots
    FOR EACH ROW EXECUTE FUNCTION public.check_inventory_thresholds();

-- Create function to get current inventory status with thresholds
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_inventory_status_with_thresholds' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_inventory_status_with_thresholds()
RETURNS TABLE(
    raw_material_id UUID,
    material_code TEXT,
    material_name TEXT,
    supplier TEXT,
    current_quantity_kg NUMERIC,
    min_quantity_kg NUMERIC,
    reorder_quantity_kg NUMERIC,
    alert_enabled BOOLEAN,
    status TEXT,
    percentage_of_minimum NUMERIC
)
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
            raw_material_id,
            SUM(quantity - qty_reserved_kg) as total_available
        FROM public.raw_material_lots
        WHERE quantity > qty_reserved_kg
        GROUP BY raw_material_id
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

-- Add updated_at trigger for inventory_thresholds
DROP TRIGGER IF EXISTS update_inventory_thresholds_updated_at ON public.inventory_thresholds;
CREATE TRIGGER update_inventory_thresholds_updated_at
    BEFORE UPDATE ON public.inventory_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default thresholds for existing materials (optional - can be managed via UI)
INSERT INTO public.inventory_thresholds (raw_material_id, min_quantity_kg, reorder_quantity_kg, alert_enabled)
SELECT 
    rm.id,
    50.0 as min_quantity_kg,  -- Default 50kg minimum
    100.0 as reorder_quantity_kg,  -- Default 100kg reorder point
    true as alert_enabled
FROM public.raw_materials rm
WHERE NOT rm.is_archived
AND NOT EXISTS (
    SELECT 1 FROM public.inventory_thresholds it 
    WHERE it.raw_material_id = rm.id
)
LIMIT 10;  -- Only add for first 10 materials to avoid overwhelming alerts