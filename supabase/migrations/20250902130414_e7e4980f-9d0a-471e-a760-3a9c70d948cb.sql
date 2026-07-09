-- SECURITY FIX: Protect raw_material_usage_stats view access
-- Since this is a view, we cannot apply RLS directly, but we can add additional protections

-- First, ensure the view is properly documented as security-sensitive
COMMENT ON VIEW public.raw_material_usage_stats IS 
'SECURITY SENSITIVE: Contains manufacturing intelligence including supplier data, usage patterns, and production volumes. Access must be restricted to authorized users only. Use get_raw_material_usage_stats() function for secure access.';

-- Create a security function to validate access to usage stats
-- This provides an additional layer of protection
CREATE OR REPLACE FUNCTION public.validate_usage_stats_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow access to users with admin or production_manager roles
    IF NOT (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized access attempt
        RAISE LOG 'SECURITY: Unauthorized access attempt to raw_material_usage_stats by user: %', auth.uid();
        RETURN false;
    END IF;
    
    -- Log authorized access for audit trail
    RAISE LOG 'SECURITY: Authorized access to raw_material_usage_stats by user: %', auth.uid();
    RETURN true;
END;
$$;

-- Create a secure wrapper view that includes access validation
-- This provides controlled access to the sensitive data
CREATE OR REPLACE VIEW public.secure_usage_stats AS
SELECT 
    rmus.raw_material_id,
    rmus.code,
    rmus.name,
    rmus.supplier,
    rmus.usage_count,
    rmus.total_quantity_used,
    rmus.last_used_date,
    rmus.first_used_date
FROM public.raw_material_usage_stats rmus
WHERE validate_usage_stats_access() = true;

-- Add a security warning comment
COMMENT ON VIEW public.secure_usage_stats IS 
'Secure wrapper for raw_material_usage_stats with built-in access validation. This view enforces role-based access control for sensitive manufacturing data.';

-- Grant appropriate permissions
REVOKE ALL ON public.raw_material_usage_stats FROM PUBLIC;
GRANT SELECT ON public.secure_usage_stats TO authenticated;