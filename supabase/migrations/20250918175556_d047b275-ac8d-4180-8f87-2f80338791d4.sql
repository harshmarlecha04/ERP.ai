-- Fix validate_formula_access_secure to avoid INSERT during read-only queries
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(
    _user_id uuid,
    _formula_id uuid, 
    _access_type text DEFAULT 'view'
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    formula_security_level text;
    formula_classification text;
    has_role_access boolean := false;
    has_active_session boolean := false;
    user_role text;
BEGIN
    -- Null check - deny access if no user
    IF _user_id IS NULL OR _formula_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get formula security information
    SELECT security_level, classification_level 
    INTO formula_security_level, formula_classification
    FROM public.formulas 
    WHERE id = _formula_id AND NOT is_deleted;
    
    -- Formula doesn't exist or is deleted
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check user roles
    has_role_access := (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'rd_manager'::app_role)
    );
    
    -- For TRADE SECRET formulas
    IF formula_security_level = 'trade_secret' OR formula_classification = 'trade_secret' THEN
        -- Production managers have special access for production operations
        IF has_role(_user_id, 'production_manager'::app_role) AND _access_type = 'view' THEN
            -- Note: Logging removed to avoid read-only transaction issues
            -- Access is logged via triggers when formulas are actually accessed
            RETURN true;
        END IF;
        
        -- Admin override: admins can bypass trade secret restrictions  
        IF has_role(_user_id, 'admin'::app_role) THEN
            -- Note: Logging removed to avoid read-only transaction issues
            -- Access is logged via triggers when formulas are actually accessed
            RETURN true;
        END IF;
        
        -- For other users, check for active approved session
        SELECT EXISTS (
            SELECT 1 FROM public.trade_secret_access_sessions_enhanced tse
            JOIN public.formula_access_requests far ON (
                far.user_id = tse.user_id 
                AND far.formula_id = tse.formula_id 
                AND far.status = 'approved'
            )
            WHERE tse.user_id = _user_id
            AND tse.formula_id = _formula_id
            AND tse.is_active = true
            AND tse.expires_at > now()
        ) INTO has_active_session;
        
        RETURN has_active_session;
    END IF;
    
    -- For CONFIDENTIAL formulas - require role access
    IF formula_security_level = 'confidential' OR formula_classification = 'confidential' THEN
        RETURN has_role_access;
    END IF;
    
    -- For STANDARD formulas - allow all authenticated users with basic role access
    RETURN has_role_access OR has_role(_user_id, 'production_manager'::app_role);
END;
$function$;