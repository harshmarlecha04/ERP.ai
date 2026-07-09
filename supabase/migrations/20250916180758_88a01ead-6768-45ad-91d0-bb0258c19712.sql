-- Insert inventory alerts for materials that are below their thresholds but don't have active alerts
INSERT INTO public.security_alerts (
    alert_type,
    severity,
    details
)
SELECT 
    'low_inventory',
    CASE 
        WHEN available_quantity <= (min_quantity_kg * 0.1) THEN 'critical'
        WHEN available_quantity <= min_quantity_kg THEN 'high'
        ELSE 'medium'
    END as severity,
    jsonb_build_object(
        'raw_material_id', rm.id,
        'material_code', rm.code,
        'material_name', rm.name,
        'supplier', rm.supplier,
        'current_quantity_kg', available_quantity,
        'min_quantity_kg', it.min_quantity_kg,
        'reorder_quantity_kg', it.reorder_quantity_kg,
        'message', CONCAT(
            CASE 
                WHEN available_quantity <= (it.min_quantity_kg * 0.1) THEN 'CRITICAL: '
                ELSE 'LOW INVENTORY: '
            END,
            rm.name, ' (', rm.code, ') is ',
            CASE 
                WHEN available_quantity <= (it.min_quantity_kg * 0.1) THEN 'critically low'
                ELSE 'below minimum threshold'
            END,
            ' at ', ROUND(available_quantity, 2), ' kg (minimum: ', ROUND(it.min_quantity_kg, 2), ' kg)'
        ),
        'triggered_by', 'MANUAL_FIX',
        'triggered_at', now()
    )
FROM inventory_thresholds it
JOIN raw_materials rm ON rm.id = it.raw_material_id
JOIN (
    SELECT 
        rml.raw_material_id,
        COALESCE(SUM(rml.quantity - COALESCE(rml.qty_reserved_kg, 0)), 0) as available_quantity
    FROM raw_material_lots rml
    GROUP BY rml.raw_material_id
) lots ON lots.raw_material_id = rm.id
WHERE it.alert_enabled = true
  AND available_quantity <= it.min_quantity_kg
  AND NOT EXISTS (
      SELECT 1 FROM public.security_alerts sa
      WHERE sa.alert_type = 'low_inventory'
        AND sa.details->>'raw_material_id' = rm.id::text
        AND sa.acknowledged = false
  );