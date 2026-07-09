-- Drop the existing policy and recreate it
DROP POLICY IF EXISTS "Authenticated users can view activity audit" ON public.user_activity_audit;

CREATE POLICY "Authenticated users can view activity audit"
ON public.user_activity_audit
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert some sample activity data to demonstrate the system
INSERT INTO public.user_activity_audit (
    user_id, activity_type, table_name, operation, record_id,
    new_values, ip_address, details, risk_level
) VALUES 
(
    auth.uid(), -- Current user
    'inventory_management',
    'raw_materials',
    'INSERT',
    gen_random_uuid()::text,
    '{"name": "Sample Material", "code": "MAT001", "supplier": "Test Supplier"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T18:30:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
),
(
    auth.uid(),
    'procurement',
    'purchase_orders',
    'UPDATE',
    gen_random_uuid()::text,
    '{"status": "delivered", "received_date": "2025-01-11"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T17:15:00Z", "trigger": "sample_data"}'::jsonb,
    'medium'
),
(
    auth.uid(),
    'user_management',
    'user_roles',
    'INSERT',
    gen_random_uuid()::text,
    '{"role": "production_manager", "granted_by": "admin"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T16:45:00Z", "trigger": "sample_data"}'::jsonb,
    'high'
),
(
    auth.uid(),
    'production_planning',
    'production_schedules',
    'DELETE',
    gen_random_uuid()::text,
    '{"schedule_date": "2025-01-15", "status": "cancelled"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T15:30:00Z", "trigger": "sample_data"}'::jsonb,
    'critical'
),
(
    auth.uid(),
    'lot_management',
    'raw_material_lots',
    'UPDATE',
    gen_random_uuid()::text,
    '{"quantity": 500, "lot_number": "LOT-2025-001"}'::jsonb,
    '192.168.1.100',
    '{"timestamp": "2025-01-11T14:20:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
);