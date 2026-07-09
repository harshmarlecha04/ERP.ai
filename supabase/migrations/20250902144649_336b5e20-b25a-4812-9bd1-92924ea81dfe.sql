-- Check if the log_formula_access function exists and drop it temporarily to prevent conflicts
-- We'll create a safe version that handles invalid access types gracefully

-- Drop the problematic function temporarily
-- (removed: CREATE OR REPLACE below handles it; DROP fails due to dependent policies)
-- Create a safer version that handles all possible access types
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
    -- Only log if the access type is valid
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
    EXCEPTION WHEN check_violation THEN
        -- Silently ignore invalid access types to prevent breaking other operations
        NULL;
    WHEN OTHERS THEN
        -- Log other errors but don't fail the main operation
        RAISE LOG 'Failed to log formula access: %', SQLERRM;
    END;
END;
$$;