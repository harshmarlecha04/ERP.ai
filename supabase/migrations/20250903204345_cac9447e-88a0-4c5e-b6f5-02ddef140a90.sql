-- Fix critical security vulnerability: Restrict formula access based on security levels and permissions
-- Drop all existing policies on formulas table
DROP POLICY IF EXISTS "All authenticated users can manage formulas" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula access for viewing" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula creation" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula updates" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula deletion" ON public.formulas;

-- Create secure RLS policies for formulas based on security levels and user permissions

-- Policy for SELECT: Only allow access if user has proper clearance/permission
CREATE POLICY "Secure formula access for viewing" 
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
);

-- Policy for INSERT: Only R&D managers and admins can create formulas
CREATE POLICY "Secure formula creation" 
ON public.formulas 
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role)
);

-- Policy for UPDATE: Restrict updates based on security level and user permissions
CREATE POLICY "Secure formula updates" 
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
);

-- Policy for DELETE: Only admins can delete formulas
CREATE POLICY "Secure formula deletion" 
ON public.formulas 
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Update the existing formula access function to be more comprehensive
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