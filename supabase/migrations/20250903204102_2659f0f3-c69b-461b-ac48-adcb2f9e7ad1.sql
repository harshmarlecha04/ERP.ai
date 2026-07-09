-- Fix critical security vulnerability: Restrict formula access based on security levels and permissions
-- Drop the overly permissive RLS policy
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can manage formulas" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create secure RLS policies for formulas based on security levels and user permissions

-- Policy for SELECT: Only allow access if user has proper clearance/permission
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula access for viewing" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula access for viewing" 
ON public.formulas 
FOR SELECT
TO authenticated
USING (
  NOT is_deleted AND (
    -- Allow access for standard security level formulas to production roles
    (security_level = 'standard' AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'rd_manager'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role)
    )) OR
    -- Use the secure validation function for confidential and trade secret formulas
    (security_level IN ('confidential', 'trade_secret') AND 
     validate_formula_access_secure(auth.uid(), id, 'view'))
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Policy for INSERT: Only R&D managers and admins can create formulas
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula creation" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula creation" 
ON public.formulas 
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Policy for UPDATE: Restrict updates based on security level and user permissions
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula updates" 
ON public.formulas 
FOR UPDATE
TO authenticated
USING (
  NOT is_deleted AND (
    -- Allow updates for standard formulas by authorized roles
    (security_level = 'standard' AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'rd_manager'::app_role)
    )) OR
    -- Use secure validation for sensitive formulas
    (security_level IN ('confidential', 'trade_secret') AND 
     validate_formula_access_secure(auth.uid(), id, 'edit'))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Policy for DELETE: Only admins can soft delete formulas
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula deletion" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure formula deletion" 
ON public.formulas 
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update the existing formula access function to be more comprehensive
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_specific_formula' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.can_access_specific_formula(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    formula_security_level text;
    user_has_access boolean := false;
BEGIN
    -- Get the formula security level
    SELECT security_level INTO formula_security_level
    FROM public.formulas 
    WHERE id = _formula_id AND NOT is_deleted;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Log the access attempt for audit purposes
    PERFORM public.log_formula_access(_user_id, _formula_id, 'access_attempt', 
        jsonb_build_object('security_level', formula_security_level));
    
    -- Use the secure validation function
    user_has_access := public.validate_formula_access_secure(_user_id, _formula_id, 'view');
    
    -- If access is granted, log successful access
    IF user_has_access THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_granted', 
            jsonb_build_object('security_level', formula_security_level));
    ELSE
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied', 
            jsonb_build_object('security_level', formula_security_level, 'reason', 'insufficient_permissions'));
    END IF;
    
    RETURN user_has_access;
END;
$$;

-- Create a function to check if user can list formulas (for the formulas page)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_accessible_formulas' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
RETURNS TABLE(
    id uuid,
    code text,
    name text,
    security_level text,
    classification_level text,
    status text,
    version text,
    default_batch_size_kg numeric,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    access_count integer,
    requires_approval boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.code,
        f.name,
        f.security_level,
        f.classification_level,
        f.status,
        f.version,
        f.default_batch_size_kg,
        f.created_at,
        f.updated_at,
        f.last_accessed_at,
        f.access_count,
        f.requires_approval
    FROM public.formulas f
    WHERE NOT f.is_deleted
    AND (
        -- Standard formulas accessible to production roles
        (f.security_level = 'standard' AND (
            has_role(_user_id, 'admin'::app_role) OR 
            has_role(_user_id, 'rd_manager'::app_role) OR 
            has_role(_user_id, 'production_manager'::app_role)
        )) OR
        -- Sensitive formulas require explicit permission validation
        (f.security_level IN ('confidential', 'trade_secret') AND 
         validate_formula_access_secure(_user_id, f.id, 'view'))
    )
    ORDER BY f.updated_at DESC;
END;
$$;