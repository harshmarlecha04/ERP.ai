-- Fix critical security vulnerability in formula access control
-- Part 1: Drop existing conflicting function and recreate with proper security

-- Drop existing function that conflicts with our new implementation
DROP FUNCTION IF EXISTS public.approve_trade_secret_access(uuid, boolean, text);

-- Now create the missing validate_formula_access_secure function that's referenced in RLS
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
    
    -- For TRADE SECRET formulas - require explicit approval even for admins
    IF formula_security_level = 'trade_secret' OR formula_classification = 'trade_secret' THEN
        -- Check for active approved session
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
            AND far.expires_at > now()
        ) INTO has_active_session;
        
        -- Trade secrets require both role access AND approved session
        RETURN has_role_access AND has_active_session;
    END IF;
    
    -- For CONFIDENTIAL formulas - require admin/rd_manager role + business hours check
    IF formula_security_level = 'confidential' OR formula_classification = 'confidential' THEN
        -- Check business hours access for confidential formulas
        IF NOT has_business_hours_access(_user_id) THEN
            RETURN false;
        END IF;
        RETURN has_role_access;
    END IF;
    
    -- For STANDARD formulas - allow production managers as well
    IF formula_security_level = 'standard' OR formula_classification = 'standard' OR 
       formula_security_level IS NULL OR formula_classification IS NULL THEN
        RETURN (
            has_role_access OR 
            has_role(_user_id, 'production_manager'::app_role)
        );
    END IF;
    
    -- Default deny for unknown security levels
    RETURN false;
END;
$function$;

-- Create function to log enhanced formula access for audit trail
CREATE OR REPLACE FUNCTION public.log_formula_access_enhanced(
    _user_id uuid,
    _formula_id uuid,
    _access_type text,
    _details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    formula_security_level text;
    risk_level text := 'medium';
BEGIN
    -- Get formula security level to determine risk
    SELECT security_level INTO formula_security_level
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- Set risk level based on formula classification
    risk_level := CASE 
        WHEN formula_security_level = 'trade_secret' THEN 'critical'
        WHEN formula_security_level = 'confidential' THEN 'high'
        ELSE 'medium'
    END;
    
    -- Enhanced details with security context
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id, 
        access_type,
        details,
        risk_level,
        ip_address,
        user_agent,
        accessed_at
    ) VALUES (
        _user_id,
        _formula_id,
        _access_type,
        _details || jsonb_build_object(
            'security_level', formula_security_level,
            'timestamp_utc', now(),
            'session_validation', 'enhanced'
        ),
        risk_level,
        inet_client_addr(),
        current_setting('request.headers', true)::jsonb->>'user-agent',
        now()
    );
END;
$function$;

-- Create function to check business hours (enhanced security for confidential formulas)
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    current_hour integer;
    current_day integer;
BEGIN
    -- Get current hour (0-23) and day of week (0=Sunday, 6=Saturday) in local time
    current_hour := EXTRACT(hour FROM now());
    current_day := EXTRACT(dow FROM now());
    
    -- Business hours: Monday-Friday, 6 AM - 10 PM
    RETURN (current_day BETWEEN 1 AND 5) AND (current_hour BETWEEN 6 AND 22);
END;
$function$;

-- Create RPC function to get accessible formulas with proper security filtering
CREATE OR REPLACE FUNCTION public.get_accessible_formulas()
RETURNS TABLE (
    id uuid,
    code text,
    name text,
    formula_code text,
    product_code_line text,
    default_batch_size_kg numeric,
    average_piece_weight numeric,
    total_pieces integer,
    recipe_json jsonb,
    active_ingredients_json jsonb,
    procedure_text text,
    notes text,
    version text,
    yield_uom text,
    status text,
    security_level text,
    classification_level text,
    requires_approval boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    access_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- This function uses the RLS policies automatically
    -- and provides a clean interface for the frontend
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.formula_code, f.product_code_line,
        f.default_batch_size_kg, f.average_piece_weight, f.total_pieces,
        f.recipe_json, f.active_ingredients_json, f.procedure_text,
        f.notes, f.version, f.yield_uom, f.status,
        f.security_level, f.classification_level, f.requires_approval,
        f.created_at, f.updated_at, f.last_accessed_at, f.access_count
    FROM public.formulas f
    WHERE NOT f.is_deleted
    ORDER BY f.updated_at DESC;
END;
$function$;