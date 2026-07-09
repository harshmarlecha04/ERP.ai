-- Fix critical security vulnerability: Add RLS policies to raw_material_usage_stats table
-- This table contains sensitive manufacturing data and must be protected

-- Enable Row Level Security on the raw_material_usage_stats table
ALTER TABLE public.raw_material_usage_stats ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict access to admin and production_manager roles only
-- This aligns with the existing get_raw_material_usage_stats() function permissions
CREATE POLICY "Only admins and production managers can view usage stats" 
ON public.raw_material_usage_stats 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- Create policy for system operations (like materialized view refreshes)
-- This allows the system to update the table as needed
CREATE POLICY "System can manage usage stats data" 
ON public.raw_material_usage_stats 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add audit logging for access to this sensitive data
-- This helps track who accesses manufacturing intelligence
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
CREATE TRIGGER audit_usage_stats_select_trigger
    AFTER SELECT ON public.raw_material_usage_stats
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.audit_usage_stats_access();