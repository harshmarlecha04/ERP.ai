-- Fix the security definer view issue and improve the security approach
-- Remove the problematic security definer view and create a better solution

-- Drop the security definer view that was flagged as a security risk
DROP VIEW IF EXISTS public.secure_usage_stats;

-- Instead, ensure the existing get_raw_material_usage_stats() function is the only safe way to access this data
-- Update the function to have proper search_path (fixing the linter warning)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_raw_material_usage_stats' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_raw_material_usage_stats()
RETURNS TABLE(
  raw_material_id uuid, 
  code text, 
  name text, 
  supplier text, 
  usage_count bigint, 
  total_quantity_used numeric, 
  last_used_date timestamp with time zone, 
  first_used_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog  -- Fix the search path warning
AS $$
BEGIN
  -- Check if user has required permissions
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production_manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied: Insufficient permissions to view usage statistics';
  END IF;
  
  -- Log the access for audit purposes
  RAISE LOG 'SECURITY AUDIT: User % accessed raw material usage statistics', auth.uid();
  
  -- Return the usage statistics data
  RETURN QUERY
  SELECT 
    rmus.raw_material_id,
    rmus.code,
    rmus.name,
    rmus.supplier,
    rmus.usage_count,
    rmus.total_quantity_used,
    rmus.last_used_date,
    rmus.first_used_date
  FROM public.raw_material_usage_stats rmus;
END;
$$;

-- Ensure proper permissions: revoke direct access to the view
-- This forces users to go through the secure function
REVOKE ALL PRIVILEGES ON public.raw_material_usage_stats FROM PUBLIC;
REVOKE ALL PRIVILEGES ON public.raw_material_usage_stats FROM authenticated;

-- Only allow the authenticated role to use the secure function
GRANT EXECUTE ON FUNCTION public.get_raw_material_usage_stats() TO authenticated;

-- Add security documentation
COMMENT ON FUNCTION public.get_raw_material_usage_stats() IS 
'SECURE FUNCTION: Provides controlled access to sensitive manufacturing usage statistics. Includes role-based authorization and audit logging. This is the ONLY approved method to access raw_material_usage_stats data.';

-- Update the validate function to have proper search_path as well
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_usage_stats_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_usage_stats_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog  -- Fix the search path warning
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