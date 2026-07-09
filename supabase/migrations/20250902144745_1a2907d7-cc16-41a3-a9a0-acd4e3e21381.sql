-- Replace the problematic log_formula_access function with a safer version
-- that handles invalid access types gracefully without breaking other operations

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_formula_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_formula_access(
    _user_id uuid,
    _formula_id uuid,
    _access_type text,
    _details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only log if we have valid input and access type is in our allowed list
    IF _user_id IS NULL OR _formula_id IS NULL OR _access_type IS NULL THEN
        RETURN;
    END IF;
    
    -- Use a try-catch approach to handle any constraint violations gracefully
    BEGIN
        INSERT INTO public.formula_access_audit (
            user_id, 
            formula_id, 
            access_type, 
            details, 
            accessed_at, 
            risk_level
        ) VALUES (
            _user_id, 
            _formula_id, 
            _access_type, 
            _details, 
            now(), 
            CASE 
                WHEN _access_type IN ('admin_access', 'trade_secret_access') THEN 'high'
                WHEN _access_type IN ('access_denied_confidential', 'access_denied_hours') THEN 'medium'
                ELSE 'low'
            END
        );
    EXCEPTION 
        WHEN check_violation THEN
            -- Silently ignore invalid access types to prevent breaking other operations
            RAISE LOG 'Invalid access type ignored: %', _access_type;
        WHEN OTHERS THEN
            -- Log other errors but don't fail the main operation
            RAISE LOG 'Failed to log formula access: %', SQLERRM;
    END;
END;
$$;