-- CRITICAL SECURITY FIX: Phase 2 - Upgrade formulas and policies
-- Complete the trade secret protection implementation

-- 1. Manually upgrade all formulas with recipe data to trade secret status
-- This protects the proprietary manufacturing information
UPDATE public.formulas 
SET 
    security_level = 'trade_secret',
    classification_level = 'trade_secret', 
    requires_approval = true
WHERE recipe_json IS NOT NULL 
   AND recipe_json != '[]'::jsonb
   AND NOT is_deleted;

-- 2. Update RLS policy to use the new strict validation
DO $pol$ BEGIN DROP POLICY IF EXISTS "Enhanced trade secret protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure formula access for viewing" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new enhanced policy with strict trade secret controls
DO $pol$ BEGIN DROP POLICY IF EXISTS "Multi-tier formula security with trade secret protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Multi-tier formula security with trade secret protection" 
ON public.formulas 
FOR SELECT 
USING (
  NOT is_deleted AND (
    -- Standard formulas: Normal role-based access
    (security_level = 'standard' AND 
     (has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'rd_manager'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role))
    ) OR
    -- Trade secret formulas: STRICT validation required
    (security_level = 'trade_secret' AND 
     validate_trade_secret_access_strict(auth.uid(), id)
    )
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. Create emergency lockdown function for immediate threat response
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='enable_emergency_lockdown' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.enable_emergency_lockdown(reason TEXT DEFAULT 'Security incident')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can enable emergency lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RAISE EXCEPTION 'Access denied: Only administrators can enable emergency lockdown';
    END IF;
    
    -- Enable emergency lockdown
    UPDATE public.security_config 
    SET config_value = jsonb_set(config_value, '{enabled}', 'true')
    WHERE config_key = 'emergency_lockdown';
    
    -- Log the lockdown activation
    INSERT INTO public.security_alerts (alert_type, severity, details)
    VALUES ('emergency_lockdown_activated', 'critical', 
           jsonb_build_object('activated_by', auth.uid(), 'reason', reason, 'time', now()));
           
    -- Terminate all active trade secret sessions
    UPDATE public.trade_secret_access_sessions 
    SET is_active = false, 
        terminated_reason = 'emergency_lockdown',
        terminated_at = now()
    WHERE is_active = true;
END;
$$;

-- 4. Add function to check trade secret access status
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='check_trade_secret_access_status' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.check_trade_secret_access_status()
RETURNS TABLE(
    can_access_trade_secrets boolean,
    reason text,
    business_hours boolean,
    is_admin boolean,
    lockdown_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _is_business_hours boolean;
    _is_admin boolean;
    _lockdown_active boolean;
    _reason text;
BEGIN
    -- Check emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO _lockdown_active
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    -- Check admin role
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO _is_admin;
    
    -- Check business hours
    _is_business_hours := (
        EXTRACT(hour FROM now()) BETWEEN 8 AND 17 AND
        EXTRACT(dow FROM now()) BETWEEN 1 AND 5
    );
    
    -- Determine access status and reason
    IF _lockdown_active THEN
        _reason := 'Emergency lockdown is active';
    ELSIF NOT _is_admin THEN
        _reason := 'Admin role required for trade secret access';
    ELSIF NOT _is_business_hours THEN
        _reason := 'Access restricted to business hours (8 AM - 5 PM, Mon-Fri)';
    ELSE
        _reason := 'Access granted';
    END IF;
    
    RETURN QUERY SELECT 
        (_is_admin AND _is_business_hours AND NOT _lockdown_active) as can_access_trade_secrets,
        _reason as reason,
        _is_business_hours as business_hours,
        _is_admin as is_admin,
        _lockdown_active as lockdown_active;
END;
$$;