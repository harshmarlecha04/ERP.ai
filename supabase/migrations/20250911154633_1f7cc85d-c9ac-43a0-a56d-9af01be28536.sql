-- Create comprehensive business hours validation function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='is_business_hours' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    current_time_est timestamptz;
    day_of_week integer;
    hour_of_day integer;
BEGIN
    -- Convert current UTC time to America/New_York timezone
    current_time_est := now() AT TIME ZONE 'America/New_York';
    
    -- Get day of week (1=Sunday, 2=Monday, ..., 7=Saturday)
    day_of_week := EXTRACT(DOW FROM current_time_est);
    
    -- Get hour of day (0-23)
    hour_of_day := EXTRACT(HOUR FROM current_time_est);
    
    -- Check if it's Monday-Friday (2-6) and between 7 AM and 7 PM
    RETURN (day_of_week BETWEEN 2 AND 6) AND (hour_of_day BETWEEN 7 AND 18);
END;
$$;

-- Update trade secret access validation to allow all users during business hours
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_trade_secret_access_enhanced' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_enhanced(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_classification text;
    has_specific_access boolean := false;
    is_business_time boolean;
BEGIN
    -- Check if it's business hours
    is_business_time := public.is_business_hours();
    
    -- Get formula classification level
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- During business hours, all authenticated users can access trade secrets
    IF is_business_time AND _user_id IS NOT NULL THEN
        -- Log the business hours access
        PERFORM public.log_formula_access(_user_id, _formula_id, 'business_hours_access', 
            jsonb_build_object(
                'access_reason', 'business_hours_policy',
                'classification', formula_classification,
                'timestamp', now()
            )
        );
        RETURN true;
    END IF;
    
    -- Outside business hours, use existing role-based access
    IF formula_classification = 'trade_secret' THEN
        -- Check for explicit approval in access requests
        SELECT EXISTS (
            SELECT 1 FROM public.formula_access_requests far
            JOIN public.formula_access_permissions fap ON fap.user_id = far.user_id AND fap.formula_id = far.formula_id
            WHERE far.user_id = _user_id 
            AND far.formula_id = _formula_id
            AND far.status = 'approved'
            AND fap.is_active = true
            AND (fap.expires_at IS NULL OR fap.expires_at > now())
            AND (far.expires_at IS NULL OR far.expires_at > now())
        ) INTO has_specific_access;
        
        RETURN has_specific_access;
    END IF;
    
    -- For non-trade-secret formulas, use existing logic
    RETURN public.can_access_specific_formula(_user_id, _formula_id, 'read');
END;
$$;

-- Drop and recreate all supplier policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Essential roles supplier access via secure function" ON public.suppliers;
    DROP POLICY IF EXISTS "Block direct supplier contact access" ON public.suppliers;
    DROP POLICY IF EXISTS "Business hours supplier access" ON public.suppliers;
    DROP POLICY IF EXISTS "Business hours supplier view access" ON public.suppliers;
    DROP POLICY IF EXISTS "Secure supplier creation" ON public.suppliers;
    DROP POLICY IF EXISTS "Secure supplier deletion" ON public.suppliers;
    DROP POLICY IF EXISTS "Secure supplier updates" ON public.suppliers;
    DROP POLICY IF EXISTS "Admin supplier management" ON public.suppliers;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Create new supplier policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "business_hours_supplier_view" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "business_hours_supplier_view" 
ON public.suppliers 
FOR SELECT 
USING (
    (auth.uid() IS NOT NULL) AND 
    (
        public.is_business_hours() OR 
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'production_manager'::app_role)
    )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "admin_supplier_mgmt" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "admin_supplier_mgmt" 
ON public.suppliers 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Drop and recreate formula policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Unrestricted admin formula access v2" ON public.formulas;
    DROP POLICY IF EXISTS "Business hours enhanced formula access" ON public.formulas;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "business_hours_formula_access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "business_hours_formula_access" 
ON public.formulas 
FOR SELECT 
USING (
    (NOT is_deleted) AND 
    (
        -- Business hours: all authenticated users can access all formulas
        (public.is_business_hours() AND auth.uid() IS NOT NULL) OR
        -- Outside business hours: existing role-based access
        (has_role(auth.uid(), 'admin'::app_role)) OR 
        ((security_level = 'standard'::text) AND (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role))) OR 
        ((security_level = 'confidential'::text) AND has_role(auth.uid(), 'rd_manager'::app_role)) OR 
        ((security_level = 'trade_secret'::text) AND validate_trade_secret_access_enhanced(auth.uid(), id))
    )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;