-- Fix formula access audit to allow null formula_id for list requests
ALTER TABLE public.formula_access_audit ALTER COLUMN formula_id DROP NOT NULL;

-- Drop all existing get_accessible_formulas functions
DROP FUNCTION IF EXISTS public.get_accessible_formulas() CASCADE;
DROP FUNCTION IF EXISTS public.get_accessible_formulas(uuid) CASCADE;

-- Create enhanced log_formula_access function that handles null formula_id
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_formula_access_enhanced' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_formula_access_enhanced(_user_id uuid, _formula_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Log to audit table, allowing null formula_id for list access
DO $aud$ BEGIN INSERT INTO public.formula_access_audit (
        user_id,
        formula_id,
        access_type,
        details,
        accessed_at
    ) VALUES (
        _user_id,
        _formula_id, -- Can be null for list requests
        _access_type,
        _details,
        now()
    ); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
END;
$function$;

-- Create get_accessible_formulas function with enhanced business hours validation
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_accessible_formulas' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
 RETURNS TABLE(id uuid, code text, name text, default_batch_size_kg numeric, recipe_json jsonb, active_ingredients_json jsonb, security_level text, classification_level text, version text, yield_uom text, notes text, product_code_line text, procedure_text text, status text, created_at timestamp with time zone, updated_at timestamp with time zone, last_accessed_at timestamp with time zone, access_count integer, requires_approval boolean, is_deleted boolean, average_piece_weight numeric, total_pieces integer, formula_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_hour integer;
    current_day integer;
    is_business_hours boolean := false;
BEGIN
    -- Check if user exists and is authenticated
    IF _user_id IS NULL THEN
        -- Log access attempt with null formula_id (list request)
        PERFORM public.log_formula_access_enhanced(
            _user_id,
            NULL, -- null formula_id for list requests
            'unauthorized_list_access',
            jsonb_build_object(
                'error', 'unauthenticated_user',
                'timestamp', now()
            )
        );
        RETURN;
    END IF;

    -- Calculate business hours (7 AM - 6 PM EST, Monday-Friday)
    current_hour := EXTRACT(hour FROM (now() AT TIME ZONE 'America/New_York'));
    current_day := EXTRACT(dow FROM (now() AT TIME ZONE 'America/New_York'));
    
    -- Business hours: Monday-Friday (1-5), 7 AM - 6 PM EST
    is_business_hours := (current_day BETWEEN 1 AND 5) AND (current_hour BETWEEN 7 AND 17);

    -- Log the formula list access attempt
    PERFORM public.log_formula_access_enhanced(
        _user_id,
        NULL, -- null formula_id for list requests
        'formula_list_requested',
        jsonb_build_object(
            'security_level', 'list_access',
            'session_details', jsonb_build_object(
                'function', 'get_accessible_formulas',
                'business_hours', is_business_hours,
                'current_hour_est', current_hour,
                'current_day', current_day
            )
        )
    );

    -- Return formulas based on user roles and security levels
    RETURN QUERY
    SELECT 
        f.id, f.code, f.name, f.default_batch_size_kg, f.recipe_json, f.active_ingredients_json,
        f.security_level, f.classification_level, f.version, f.yield_uom, f.notes,
        f.product_code_line, f.procedure_text, f.status, f.created_at, f.updated_at,
        f.last_accessed_at, f.access_count, f.requires_approval, f.is_deleted,
        f.average_piece_weight, f.total_pieces, f.formula_code
    FROM public.formulas f
    WHERE 
        f.is_deleted = false
        AND (
            -- Standard formulas: accessible to admin, rd_manager, production_manager
            (f.security_level = 'standard' AND (
                has_role(_user_id, 'admin'::app_role) OR
                has_role(_user_id, 'rd_manager'::app_role) OR
                has_role(_user_id, 'production_manager'::app_role)
            ))
            OR
            -- Confidential formulas: accessible to admin and rd_manager
            (f.security_level = 'confidential' AND (
                has_role(_user_id, 'admin'::app_role) OR
                has_role(_user_id, 'rd_manager'::app_role)
            ))
            OR
            -- Trade secret formulas: admin access during business hours only
            (f.security_level = 'trade_secret' AND 
                has_role(_user_id, 'admin'::app_role) AND 
                is_business_hours
            )
        )
    ORDER BY f.created_at DESC;
END;
$function$;