-- Fix validate_formula_access_secure function to work with read replicas
-- Remove INSERT operations (logging) that cause read-only transaction errors

CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(_user_id uuid, _formula_id uuid, _access_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    
    -- Removed log_formula_access call that was causing read-only transaction errors
    -- Logging during SELECT operations is not compatible with read replicas
    
    IF formula_security_level = 'trade_secret' THEN
        RETURN has_explicit_permission;
    END IF;
    
    RETURN user_has_role OR has_explicit_permission;
END;
$function$;