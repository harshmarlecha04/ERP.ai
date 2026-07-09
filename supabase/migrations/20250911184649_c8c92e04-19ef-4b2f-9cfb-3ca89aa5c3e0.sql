-- Insert sample activities with a known user ID from the users table
INSERT INTO public.user_activity_audit (
    user_id, activity_type, table_name, operation, record_id,
    new_values, ip_address, details, risk_level
) VALUES 
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea', -- Known user ID
    'inventory_management',
    'raw_materials',
    'INSERT',
    gen_random_uuid()::text,
    '{"name": "Premium Wheat Flour", "code": "WHF001", "supplier": "Grain Masters Ltd"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T18:30:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'procurement',
    'purchase_orders',
    'UPDATE',
    gen_random_uuid()::text,
    '{"status": "delivered", "received_date": "2025-01-11", "invoice_total": 2500.00}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T17:15:00Z", "trigger": "sample_data"}'::jsonb,
    'medium'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'user_management',
    'user_roles',
    'INSERT',
    gen_random_uuid()::text,
    '{"role": "production_manager", "granted_by": "admin", "department": "manufacturing"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T16:45:00Z", "trigger": "sample_data"}'::jsonb,
    'high'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'production_planning',
    'production_schedules',
    'DELETE',
    gen_random_uuid()::text,
    '{"schedule_date": "2025-01-15", "status": "cancelled", "reason": "equipment_maintenance"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T15:30:00Z", "trigger": "sample_data"}'::jsonb,
    'critical'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'lot_management',
    'raw_material_lots',
    'UPDATE',
    gen_random_uuid()::text,
    '{"quantity": 500, "lot_number": "LOT-2025-001", "expires_on": "2025-12-31"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T14:20:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'procurement',
    'purchase_orders',
    'INSERT',
    gen_random_uuid()::text,
    '{"vendor_name": "Chemical Supplies Co", "quantity": 1000, "expected_delivery": "2025-01-20"}'::jsonb,
    '10.0.0.1',
    '{"timestamp": "2025-01-11T13:10:00Z", "trigger": "sample_data"}'::jsonb,
    'medium'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'inventory_management',
    'raw_materials',
    'UPDATE',
    gen_random_uuid()::text,
    '{"name": "Organic Sugar", "supplier": "Sweet Harvest Inc", "uom": "kg"}'::jsonb,
    '192.168.1.50',
    '{"timestamp": "2025-01-11T12:00:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'production_planning',
    'production_schedules',
    'INSERT',
    gen_random_uuid()::text,
    '{"schedule_date": "2025-01-18", "formula_code": "BREAD001", "batches": 5}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T11:30:00Z", "trigger": "sample_data"}'::jsonb,
    'medium'
);