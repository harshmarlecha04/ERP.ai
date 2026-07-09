-- Enhanced security hardening for formulas table containing trade secrets
-- Implement additional protection layers for critical intellectual property

-- 1. Create comprehensive audit logging for ALL formula operations
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_formula_access_enhanced' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_formula_access_enhanced(
    _user_id uuid,
    _formula_id uuid,
    _access_type text,
    _details jsonb DEFAULT '{}'::jsonb
) RETURNS void AS $$
DECLARE
    formula_classification text;
    user_ip inet;
    risk_assessment text := 'low';
BEGIN
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
    
    -- Alert on high-risk access
    IF risk_assessment IN ('critical', 'high') THEN
        -- Insert alert (could trigger notifications in production)
        INSERT INTO public.security_alerts (
            alert_type,
            severity,
            details,
            created_at
        ) VALUES (
            'high_risk_formula_access',
            risk_assessment,
            jsonb_build_object(
                'user_id', _user_id,
                'formula_id', _formula_id,
                'access_type', _access_type,
                'classification', formula_classification,
                'ip_address', user_ip
            ),
            now()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create security alerts table for monitoring critical access
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security alerts
DO $rls$ BEGIN ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Only admins can manage security alerts
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can manage security alerts" ON public.security_alerts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can manage security alerts" 
ON public.security_alerts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. Create trigger to automatically log all formula table access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='audit_formula_access_trigger' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.audit_formula_access_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Log SELECT operations
    IF TG_OP = 'SELECT' THEN
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            NEW.id,
            'view',
            jsonb_build_object(
                'operation', 'SELECT',
                'table', 'formulas',
                'security_level', NEW.security_level,
                'classification_level', NEW.classification_level
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log INSERT operations  
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            NEW.id,
            'create',
            jsonb_build_object(
                'operation', 'INSERT',
                'formula_code', NEW.code,
                'security_level', NEW.security_level
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            NEW.id,
            'update',
            jsonb_build_object(
                'operation', 'UPDATE',
                'formula_code', NEW.code,
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each_text(to_jsonb(NEW))
                    WHERE key IN ('recipe_json', 'active_ingredients_json', 'procedure_text', 'security_level')
                    AND to_jsonb(OLD)->>key IS DISTINCT FROM value
                )
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log DELETE operations
    IF TG_OP = 'DELETE' THEN
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            OLD.id,
            'delete',
            jsonb_build_object(
                'operation', 'DELETE',
                'formula_code', OLD.code,
                'security_level', OLD.security_level
            )
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;