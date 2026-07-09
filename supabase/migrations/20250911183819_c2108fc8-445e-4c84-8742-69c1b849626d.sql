-- Fix function search path security warning
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
    -- Check if current user has access (mfg@pharmvista.com)
    IF NOT EXISTS (
        SELECT 1 FROM auth.users au
        WHERE au.id = auth.uid() 
        AND au.email = 'mfg@pharmvista.com'
    ) THEN
        RAISE EXCEPTION 'Access denied: Insufficient privileges to view activity data';
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

-- Fix audit trigger function search path
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
    activity_type_val TEXT;
    old_vals JSONB := NULL;
    new_vals JSONB := NULL;
BEGIN
    -- Determine activity type based on table
    activity_type_val := CASE TG_TABLE_NAME
        WHEN 'raw_materials' THEN 'inventory_management'
        WHEN 'raw_material_lots' THEN 'lot_management'
        WHEN 'purchase_orders' THEN 'procurement'
        WHEN 'production_schedules' THEN 'production_planning'
        WHEN 'user_roles' THEN 'user_management'
        ELSE 'general_activity'
    END;
    
    -- Handle different operations
    IF TG_OP = 'DELETE' THEN
        old_vals := to_jsonb(OLD);
        INSERT INTO public.user_activity_audit (
            user_id, activity_type, table_name, operation, record_id,
            old_values, ip_address, details
        ) VALUES (
            auth.uid(), activity_type_val, TG_TABLE_NAME, 'DELETE',
            COALESCE(OLD.id::TEXT, 'unknown'),
            old_vals, inet_client_addr(),
            jsonb_build_object('timestamp', now(), 'trigger', 'audit_log')
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        old_vals := to_jsonb(OLD);
        new_vals := to_jsonb(NEW);
        INSERT INTO public.user_activity_audit (
            user_id, activity_type, table_name, operation, record_id,
            old_values, new_values, ip_address, details
        ) VALUES (
            auth.uid(), activity_type_val, TG_TABLE_NAME, 'UPDATE',
            NEW.id::TEXT,
            old_vals, new_vals, inet_client_addr(),
            jsonb_build_object('timestamp', now(), 'trigger', 'audit_log')
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        new_vals := to_jsonb(NEW);
        INSERT INTO public.user_activity_audit (
            user_id, activity_type, table_name, operation, record_id,
            new_values, ip_address, details
        ) VALUES (
            auth.uid(), activity_type_val, TG_TABLE_NAME, 'INSERT',
            NEW.id::TEXT,
            new_vals, inet_client_addr(),
            jsonb_build_object('timestamp', now(), 'trigger', 'audit_log')
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;