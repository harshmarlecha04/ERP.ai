-- Create a replacement function that handles constraint violations gracefully
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
    -- Only proceed if we have valid inputs
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
            COALESCE(_details, '{}'::jsonb), 
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
            NULL;
        WHEN foreign_key_violation THEN
            -- Ignore if formula doesn't exist
            NULL;
        WHEN OTHERS THEN
            -- Log other errors but don't fail the main operation
            RAISE LOG 'Failed to log formula access for user % formula % type %: %', _user_id, _formula_id, _access_type, SQLERRM;
    END;
END;
$$;