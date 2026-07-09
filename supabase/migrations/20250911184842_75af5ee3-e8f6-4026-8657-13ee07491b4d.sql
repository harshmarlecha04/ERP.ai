-- Insert some sample activity data with a valid user ID
INSERT INTO public.user_activity_audit (
    user_id, activity_type, table_name, operation, record_id,
    new_values, ip_address, details, risk_level
) VALUES 
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea', -- mfg@pharmvista.com user ID
    'inventory_management',
    'raw_materials',
    'INSERT',
    gen_random_uuid()::text,
    '{"name": "Sample Material", "code": "MAT001", "supplier": "Test Supplier"}'::jsonb,
    '192.168.1.100'::inet,
    '{"timestamp": "2025-01-11T18:30:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'procurement',
    'purchase_orders',
    'UPDATE',
    gen_random_uuid()::text,
    '{"status": "delivered", "received_date": "2025-01-11"}'::jsonb,
    '192.168.1.100'::inet,
    '{"timestamp": "2025-01-11T17:15:00Z", "trigger": "sample_data"}'::jsonb,
    'medium'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'user_management',
    'user_roles',
    'INSERT',
    gen_random_uuid()::text,
    '{"role": "production_manager", "granted_by": "admin"}'::jsonb,
    '192.168.1.100'::inet,
    '{"timestamp": "2025-01-11T16:45:00Z", "trigger": "sample_data"}'::jsonb,
    'high'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'production_planning',
    'production_schedules',
    'DELETE',
    gen_random_uuid()::text,
    '{"schedule_date": "2025-01-15", "status": "cancelled"}'::jsonb,
    '192.168.1.100'::inet,
    '{"timestamp": "2025-01-11T15:30:00Z", "trigger": "sample_data"}'::jsonb,
    'critical'
),
(
    'a8a2da39-c15e-4998-b13c-8e6258ea91ea',
    'lot_management',
    'raw_material_lots',
    'UPDATE',
    gen_random_uuid()::text,
    '{"quantity": 500, "lot_number": "LOT-2025-001"}'::jsonb,
    '192.168.1.100'::inet,
    '{"timestamp": "2025-01-11T14:20:00Z", "trigger": "sample_data"}'::jsonb,
    'low'
);

-- Update the function to allow any authenticated user to view activity
CREATE OR REPLACE FUNCTION public.get_all_user_activity()
RETURNS TABLE(
    id UUID,
    user_id UUID,
    user_email TEXT,
    user_display_name TEXT,
    activity_type TEXT,
    operation TEXT,
    table_name TEXT,
    record_id TEXT,
    details JSONB,
    ip_address INET,
    risk_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public', 'pg_catalog'
AS $$
BEGIN
    -- Allow any authenticated user to view activity (removed email restriction)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Not authenticated';
    END IF;
    
    -- Return unified activity data from all audit tables
    RETURN QUERY
    WITH unified_activity AS (
        -- Formula access audit
        SELECT 
            faa.id,
            faa.user_id,
            faa.access_type as activity_type,
            'formula_access' as operation,
            'formulas' as table_name,
            faa.formula_id::TEXT as record_id,
            faa.details,
            faa.ip_address,
            faa.risk_level,
            faa.accessed_at as created_at
        FROM public.formula_access_audit faa
        
        UNION ALL
        
        -- Profile access audit  
        SELECT 
            paa.id,
            paa.viewer_id as user_id,
            paa.access_type as activity_type,
            'profile_access' as operation,
            'profiles' as table_name,
            paa.profile_id::TEXT as record_id,
            jsonb_build_object('access_reason', paa.access_reason) as details,
            paa.ip_address,
            paa.risk_level,
            paa.accessed_at as created_at
        FROM public.profile_access_audit paa
        
        UNION ALL
        
        -- Employee sensitive data audit
        SELECT 
            esda.id,
            esda.accessed_by as user_id,
            esda.access_type as activity_type,
            'employee_data_access' as operation,
            'employee_sensitive_data' as table_name,
            esda.employee_id as record_id,
            jsonb_build_object('access_reason', esda.access_reason) as details,
            esda.ip_address,
            esda.risk_level,
            esda.accessed_at as created_at
        FROM public.employee_sensitive_data_audit esda
        
        UNION ALL
        
        -- Supplier access audit
        SELECT 
            saa.id,
            saa.accessed_by as user_id,
            saa.access_type as activity_type,
            'supplier_access' as operation,
            'suppliers' as table_name,
            saa.supplier_id::TEXT as record_id,
            jsonb_build_object('access_reason', saa.access_reason) as details,
            saa.ip_address,
            saa.risk_level,
            saa.accessed_at as created_at
        FROM public.supplier_access_audit saa
        
        UNION ALL
        
        -- User activity audit (new comprehensive table)
        SELECT 
            uaa.id,
            uaa.user_id,
            uaa.activity_type,
            uaa.operation,
            uaa.table_name,
            uaa.record_id,
            uaa.details,
            uaa.ip_address,
            uaa.risk_level,
            uaa.created_at
        FROM public.user_activity_audit uaa
    )
    SELECT 
        ua.id,
        ua.user_id,
        COALESCE(au.email, 'unknown') as user_email,
        COALESCE(p.display_name, au.email, 'Unknown User') as user_display_name,
        ua.activity_type,
        ua.operation,
        ua.table_name,
        ua.record_id,
        ua.details,
        ua.ip_address,
        ua.risk_level,
        ua.created_at
    FROM unified_activity ua
    LEFT JOIN auth.users au ON au.id = ua.user_id
    LEFT JOIN public.profiles p ON p.id = ua.user_id
    ORDER BY ua.created_at DESC;
END;
$$;