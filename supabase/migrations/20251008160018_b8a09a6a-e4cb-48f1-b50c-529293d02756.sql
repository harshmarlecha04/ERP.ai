-- ========================================
-- SECURITY FIX: Restrict Supplier Data Access
-- ========================================

-- Drop existing policies if they exist
DO $pol$ BEGIN DROP POLICY IF EXISTS "business_hours_supplier_view" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_access" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_creation" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_updates" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_deletion" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new restrictive policy for viewing suppliers
-- Only admin and production_manager roles can access supplier data
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_access" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "restricted_supplier_access"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create policy for creating suppliers
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_creation" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "restricted_supplier_creation"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create policy for updating suppliers
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_updates" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "restricted_supplier_updates"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create policy for deleting suppliers (admin only)
DO $pol$ BEGIN DROP POLICY IF EXISTS "restricted_supplier_deletion" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "restricted_supplier_deletion"
ON public.suppliers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ========================================
-- SECURITY FIX: Add Search Path to Functions
-- ========================================

-- Fix is_business_hours function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='is_business_hours' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_time_et timestamp with time zone;
    current_hour integer;
    current_day integer;
BEGIN
    current_time_et := now() AT TIME ZONE 'America/New_York';
    current_hour := EXTRACT(HOUR FROM current_time_et);
    current_day := EXTRACT(DOW FROM current_time_et);
    RETURN (current_day BETWEEN 1 AND 5) AND (current_hour >= 7 AND current_hour < 19);
END;
$$;

-- Fix has_role function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='has_role' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Fix validate_formula_access_secure function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_access_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'view')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_security_level text;
    user_has_role boolean := false;
    has_explicit_permission boolean := false;
BEGIN
    SELECT security_level INTO formula_security_level
    FROM public.formulas
    WHERE id = _formula_id AND NOT is_deleted;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    user_has_role := EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role IN ('admin', 'rd_manager')
    );
    
    IF formula_security_level = 'standard' THEN
        RETURN user_has_role;
    END IF;
    
    has_explicit_permission := EXISTS (
        SELECT 1 FROM public.formula_user_permissions
        WHERE formula_id = _formula_id
        AND user_id = _user_id
        AND permission_type = _access_type
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    );
    
    IF formula_security_level = 'trade_secret' THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_attempt', 
            jsonb_build_object(
                'access_type', _access_type,
                'has_permission', has_explicit_permission,
                'security_level', formula_security_level
            )
        );
        RETURN has_explicit_permission;
    END IF;
    
    RETURN user_has_role OR has_explicit_permission;
END;
$$;

-- Create audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.supplier_access_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_by uuid NOT NULL,
    supplier_id uuid,
    access_type text NOT NULL,
    access_reason text,
    ip_address inet,
    user_agent text,
    session_id text,
    risk_level text DEFAULT 'medium',
    accessed_at timestamp with time zone DEFAULT now()
);
DO $rls$ BEGIN ALTER TABLE public.supplier_access_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "only_admins_view_supplier_audit" ON public.supplier_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "authenticated_insert_supplier_audit" ON public.supplier_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "only_admins_view_supplier_audit" ON public.supplier_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "only_admins_view_supplier_audit"
ON public.supplier_access_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "authenticated_insert_supplier_audit" ON public.supplier_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "authenticated_insert_supplier_audit"
ON public.supplier_access_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;