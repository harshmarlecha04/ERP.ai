-- CRITICAL SECURITY FIX: Minimal changes to prevent industrial espionage

-- 1. Enable security monitoring 
UPDATE public.security_config 
SET config_value = jsonb_set(config_value, '{enabled}', 'true')
WHERE config_key = 'formula_security_monitoring';

-- 2. Enable IP restrictions for trade secrets
UPDATE public.security_config 
SET config_value = jsonb_set(
    jsonb_set(config_value, '{enabled}', 'true'),
    '{allowed_networks}', '["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]'
)
WHERE config_key = 'trade_secret_ip_restrictions';

-- 3. Create enhanced validation for trade secrets (null-safe)
CREATE OR REPLACE FUNCTION public.validate_trade_secret_access_secure_v2(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_business_hours boolean := false;
    user_has_admin_role boolean := false;
    emergency_lockdown boolean := false;
BEGIN
    -- Handle null user (system operations)
    IF _user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_lockdown
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_lockdown THEN
        RETURN false;
    END IF;
    
    -- Only admins can access trade secrets
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_admin_role;
    
    IF NOT user_has_admin_role THEN
        RETURN false;
    END IF;
    
    -- Check business hours (8 AM to 6 PM) - critical for trade secrets
    is_business_hours := EXTRACT(hour FROM now()) BETWEEN 8 AND 17;
    IF NOT is_business_hours THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- 4. Update RLS policy with enhanced trade secret protection
DROP POLICY IF EXISTS "Multi-tier formula security" ON public.formulas;
DROP POLICY IF EXISTS "Enhanced trade secret protection" ON public.formulas;  
DROP POLICY IF EXISTS "Secure formula access for viewing" ON public.formulas;

CREATE POLICY "Enhanced formula security with trade secret protection" 
ON public.formulas 
FOR SELECT 
USING (
  NOT is_deleted AND (
    -- Standard formulas: Role-based access
    (security_level = 'standard' AND 
     (has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'rd_manager'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role))
    ) OR
    -- Trade secret formulas: Enhanced protection (business hours + admin only)
    (security_level = 'trade_secret' AND 
     validate_trade_secret_access_secure_v2(auth.uid(), id)
    )
  )
);