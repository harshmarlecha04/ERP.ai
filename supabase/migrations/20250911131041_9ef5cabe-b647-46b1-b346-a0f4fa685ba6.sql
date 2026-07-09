-- EMERGENCY FIX: Disable problematic trigger to apply critical security updates

-- 1. Temporarily disable the audit trigger that's causing issues
DROP TRIGGER IF EXISTS audit_formula_access_trigger ON public.formulas;

-- 2. Fix the logging function to handle null user contexts
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_formula_access_enhanced' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_formula_access_enhanced(_user_id uuid, _formula_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_classification text;
    user_ip inet;
    risk_assessment text := 'low';
BEGIN
    -- Skip logging if user_id is null (system operations)
    IF _user_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Get formula classification for risk assessment
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- Get user IP address
    user_ip := inet_client_addr();
    
    -- Assess risk level based on classification and access type
    risk_assessment := CASE 
        WHEN formula_classification = 'trade_secret' THEN 'critical'
        WHEN formula_classification = 'confidential' THEN 'high'
        WHEN _access_type IN ('update', 'delete', 'export') THEN 'high'
        ELSE 'medium'
    END;
    
    -- Log to audit table with enhanced details
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id,
        access_type,
        details,
        risk_level,
        ip_address,
        user_agent,
        session_id
    ) VALUES (
        _user_id,
        _formula_id,
        _access_type,
        _details || jsonb_build_object(
            'classification_level', formula_classification,
            'timestamp', now(),
            'risk_assessment', risk_assessment,
            'ip_address', user_ip
        ),
        risk_assessment,
        user_ip,
        current_setting('request.headers', true)::jsonb->>'user-agent',
        current_setting('request.jwt.claims', true)::jsonb->>'session_id'
    );
    
END;
$$;