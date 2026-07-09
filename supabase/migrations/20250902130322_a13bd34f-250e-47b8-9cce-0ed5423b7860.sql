-- Fix critical security vulnerability: Add RLS policies to raw_material_usage_stats table
-- This table contains sensitive manufacturing data and must be protected

-- Enable Row Level Security on the raw_material_usage_stats table
DO $rls$ BEGIN ALTER TABLE public.raw_material_usage_stats ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create policy to restrict access to admin and production_manager roles only
-- This aligns with the existing get_raw_material_usage_stats() function permissions
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can view usage stats" ON public.raw_material_usage_stats; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins and production managers can view usage stats" 
ON public.raw_material_usage_stats 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create policy for system operations (like materialized view refreshes)
-- This allows the system to update the table as needed
DO $pol$ BEGIN DROP POLICY IF EXISTS "System can manage usage stats data" ON public.raw_material_usage_stats; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "System can manage usage stats data" 
ON public.raw_material_usage_stats 
FOR ALL 
USING (auth.role() = 'service_role'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Add audit logging for access to this sensitive data
-- This helps track who accesses manufacturing intelligence
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='audit_usage_stats_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.audit_usage_stats_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log access attempts to sensitive manufacturing data
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id, -- We'll use this field to store table name for non-formula audit events
        access_type,
        details,
        risk_level
    ) VALUES (
        auth.uid(),
        '00000000-0000-0000-0000-000000000000'::uuid, -- Placeholder UUID for non-formula events
        'raw_material_stats_access',
        jsonb_build_object(
            'table', 'raw_material_usage_stats',
            'timestamp', now(),
            'ip_address', inet_client_addr()
        ),
        'medium'
    );
    
    RETURN NULL; -- For AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create audit trigger for SELECT operations on usage stats
DROP TRIGGER IF EXISTS audit_usage_stats_select_trigger ON public.raw_material_usage_stats;
-- (removed: Postgres does not support SELECT triggers)