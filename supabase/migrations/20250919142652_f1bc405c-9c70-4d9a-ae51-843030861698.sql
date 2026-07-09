-- Create missing formula access validation function
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(_user_id uuid, _formula_id uuid, _access_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If user is null, deny access
    IF _user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Admins and R&D managers have full access
    IF has_role(_user_id, 'admin'::app_role) OR has_role(_user_id, 'rd_manager'::app_role) THEN
        RETURN true;
    END IF;
    
    -- For standard security level formulas, allow authenticated users with proper roles
    IF EXISTS (
        SELECT 1 FROM public.formulas 
        WHERE id = _formula_id 
        AND security_level = 'standard' 
        AND NOT is_deleted
    ) THEN
        RETURN true;
    END IF;
    
    -- For higher security levels, check specific permissions
    IF EXISTS (
        SELECT 1 FROM public.formula_access_permissions
        WHERE formula_id = _formula_id
        AND user_id = _user_id
        AND access_type = _access_type
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;