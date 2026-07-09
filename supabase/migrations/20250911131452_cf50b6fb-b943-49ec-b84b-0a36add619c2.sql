-- FIX THE ROOT CAUSE: Make formula logging functions null-safe first

-- Fix the log_formula_access_enhanced function to handle null user contexts
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
    -- CRITICAL FIX: Handle null user_id from system operations
    IF _user_id IS NULL THEN
        -- Use a system UUID for internal operations to satisfy not-null constraint
        _user_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;
    
    -- Get formula classification for risk assessment
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- Get user IP address (may be null for system operations)
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
            'ip_address', COALESCE(user_ip::text, 'system'),
            'system_operation', (_user_id = '00000000-0000-0000-0000-000000000000'::uuid)
        ),
        risk_assessment,
        user_ip,
        current_setting('request.headers', true)::jsonb->>'user-agent',
        current_setting('request.jwt.claims', true)::jsonb->>'session_id'
    );
    
END;
$$;