-- Fix formula security vulnerability by implementing strict access controls
-- This addresses the critical security issue where trade secrets could be accessed by unauthorized users

-- 1. Drop the overly permissive existing policies
DROP POLICY IF EXISTS "Secure multi-layer formula access" ON public.formulas;
DROP POLICY IF EXISTS "Secure multi-layer formula update" ON public.formulas;

-- 2. Create new restrictive policies based on security levels
CREATE POLICY "Trade secret formulas require explicit access"
ON public.formulas
FOR SELECT
USING (
  CASE 
    WHEN security_level = 'trade_secret' THEN
      -- Trade secrets require explicit permission validation
      validate_formula_access_secure(auth.uid(), id, 'view')
    WHEN security_level = 'confidential' THEN
      -- Confidential formulas require R&D manager role or explicit permission
      (has_role(auth.uid(), 'admin'::app_role) OR 
       has_role(auth.uid(), 'rd_manager'::app_role) OR
       EXISTS (
         SELECT 1 FROM public.formula_user_permissions 
         WHERE formula_id = formulas.id 
         AND user_id = auth.uid() 
         AND permission_type IN ('view', 'edit', 'admin')
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > now())
       ))
    ELSE
      -- Standard formulas accessible to production roles
      (has_role(auth.uid(), 'admin'::app_role) OR 
       has_role(auth.uid(), 'rd_manager'::app_role) OR
       has_role(auth.uid(), 'production_manager'::app_role))
  END
  AND NOT is_deleted
);

-- 3. Secure update policy - only admins and R&D managers with logging
CREATE POLICY "Secure formula updates with audit"
ON public.formulas
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role))
  AND (log_formula_access(auth.uid(), id, 'update', jsonb_build_object('operation', 'update')) IS NULL)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_manager'::app_role))
);

-- 4. Create function to check if user can access specific formula (used by components)
CREATE OR REPLACE FUNCTION public.can_access_specific_formula(
  _user_id uuid, 
  _formula_id uuid, 
  _access_type text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  formula_security_level text;
BEGIN
  -- Get formula security level
  SELECT security_level INTO formula_security_level
  FROM public.formulas 
  WHERE id = _formula_id AND NOT is_deleted;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Use the comprehensive security validation for all access
  RETURN validate_formula_access_secure(_user_id, _formula_id, _access_type);
END;
$$;

-- 5. Create function to get accessible formulas for a user (performance optimization)
CREATE OR REPLACE FUNCTION public.get_accessible_formulas_for_user(_user_id uuid)
RETURNS TABLE(
  id uuid,
  code text,
  name text,
  security_level text,
  classification_level text,
  status text,
  version text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  requires_session boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the access attempt
  PERFORM log_formula_access(_user_id, NULL, 'list_formulas', 
    jsonb_build_object('operation', 'list_accessible_formulas'));
  
  RETURN QUERY
  SELECT 
    f.id,
    f.code,
    f.name,
    f.security_level,
    f.classification_level,
    f.status,
    f.version,
    f.created_at,
    f.updated_at,
    (f.security_level = 'trade_secret') as requires_session
  FROM public.formulas f
  WHERE NOT f.is_deleted
  AND (
    CASE 
      WHEN f.security_level = 'trade_secret' THEN
        -- For trade secrets, check explicit permissions only
        EXISTS (
          SELECT 1 FROM public.formula_user_permissions 
          WHERE formula_id = f.id 
          AND user_id = _user_id 
          AND permission_type IN ('view', 'edit', 'admin')
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > now())
          AND approval_count >= required_approvals
        )
      WHEN f.security_level = 'confidential' THEN
        -- Confidential: R&D manager or explicit permission
        (has_role(_user_id, 'admin'::app_role) OR 
         has_role(_user_id, 'rd_manager'::app_role) OR
         EXISTS (
           SELECT 1 FROM public.formula_user_permissions 
           WHERE formula_id = f.id 
           AND user_id = _user_id 
           AND permission_type IN ('view', 'edit', 'admin')
           AND is_active = true
           AND (expires_at IS NULL OR expires_at > now())
         ))
      ELSE
        -- Standard: production roles
        (has_role(_user_id, 'admin'::app_role) OR 
         has_role(_user_id, 'rd_manager'::app_role) OR
         has_role(_user_id, 'production_manager'::app_role))
    END
  )
  ORDER BY f.updated_at DESC;
END;
$$;

-- 6. Add security monitoring trigger for formula access
CREATE OR REPLACE FUNCTION public.monitor_formula_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Monitor high-risk access patterns
  IF NEW.security_level = 'trade_secret' THEN
    -- Insert security alert for trade secret access
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      details
    ) VALUES (
      'trade_secret_formula_accessed',
      'high',
      jsonb_build_object(
        'formula_id', NEW.id,
        'formula_code', NEW.code,
        'accessed_by', auth.uid(),
        'timestamp', now(),
        'security_level', NEW.security_level
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for monitoring (only on updates to avoid noise on inserts)
DROP TRIGGER IF EXISTS formula_access_monitor ON public.formulas;
CREATE TRIGGER formula_access_monitor
  AFTER UPDATE ON public.formulas
  FOR EACH ROW
  WHEN (OLD.last_accessed_at IS DISTINCT FROM NEW.last_accessed_at)
  EXECUTE FUNCTION monitor_formula_access();

-- 7. Grant necessary permissions to the security functions
GRANT EXECUTE ON FUNCTION public.can_access_specific_formula TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_formulas_for_user TO authenticated;