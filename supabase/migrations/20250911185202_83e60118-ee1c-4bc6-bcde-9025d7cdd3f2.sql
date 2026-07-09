-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_all_user_activity();

-- Create new function with explicit INET type return for IP address
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_all_user_activity' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_all_user_activity()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  user_display_name text,
  activity_type text,
  operation text,
  table_name text,
  record_id text,
  details jsonb,
  ip_address text,
  risk_level text,
  created_at timestamptz
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
            faa.ip_address::text,
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
            paa.ip_address::text,
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
            esda.ip_address::text,
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
            saa.ip_address::text,
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
            uaa.ip_address::text,
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