-- Continue enhanced security hardening - Part 2
-- Add triggers and additional security controls for formulas table

-- 4. Add field-level encryption recommendations and security controls
CREATE OR REPLACE FUNCTION public.validate_formula_security_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Enforce security level requirements for trade secrets
    IF NEW.classification_level = 'trade_secret' THEN
        -- Trade secrets must have highest security level
        IF NEW.security_level NOT IN ('confidential', 'trade_secret') THEN
            RAISE EXCEPTION 'Trade secret formulas must have confidential or trade_secret security level';
        END IF;
        
        -- Trade secrets require approval flag
        NEW.requires_approval := true;
        
        -- Log the trade secret creation/modification
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            NEW.id,
            'trade_secret_modification',
            jsonb_build_object(
                'operation', TG_OP,
                'security_enforcement', 'trade_secret_validation',
                'previous_classification', COALESCE(OLD.classification_level, 'none')
            )
        );
    END IF;
    
    -- Prevent downgrading security levels without admin approval
    IF TG_OP = 'UPDATE' AND OLD.classification_level IS NOT NULL THEN
        IF NEW.classification_level != OLD.classification_level THEN
            IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
                RAISE EXCEPTION 'Only admins can change formula classification levels';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create IP-based access restrictions for trade secrets
CREATE OR REPLACE FUNCTION public.check_formula_ip_restrictions()
RETURNS TRIGGER AS $$
DECLARE
    user_ip inet;
    allowed_networks text[];
    formula_classification text;
    is_allowed boolean := false;
BEGIN
    -- Get current IP and formula classification
    user_ip := inet_client_addr();
    formula_classification := NEW.classification_level;
    
    -- For trade secrets, implement IP restrictions
    IF formula_classification = 'trade_secret' THEN
        -- Get allowed networks from security config (can be configured by admins)
        SELECT COALESCE(
            (config_value->>'allowed_networks')::text[],
            ARRAY['0.0.0.0/0']::text[]  -- Default: allow all (should be configured in production)
        ) INTO allowed_networks
        FROM public.security_config 
        WHERE config_key = 'trade_secret_ip_restrictions';
        
        -- Check if current IP is in allowed networks
        FOR i IN 1..array_length(allowed_networks, 1) LOOP
            IF user_ip <<= allowed_networks[i]::cidr THEN
                is_allowed := true;
                EXIT;
            END IF;
        END LOOP;
        
        -- Log IP access attempt
        PERFORM public.log_formula_access_enhanced(
            auth.uid(),
            NEW.id,
            'ip_access_check',
            jsonb_build_object(
                'user_ip', user_ip,
                'allowed_networks', allowed_networks,
                'access_granted', is_allowed,
                'classification', formula_classification
            )
        );
        
        -- Block if IP not allowed (in production, this should be configured)
        -- For now, just log - uncomment below to enforce IP restrictions
        /*
        IF NOT is_allowed THEN
            RAISE EXCEPTION 'Access to trade secret formulas is restricted from your IP address: %', user_ip;
        END IF;
        */
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create the actual triggers
CREATE TRIGGER formula_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_formula_security_level();

CREATE TRIGGER formula_ip_restriction_trigger
    BEFORE SELECT ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.check_formula_ip_restrictions();

-- 7. Create emergency lockdown function for formula access
CREATE OR REPLACE FUNCTION public.emergency_formula_lockdown(
    _reason text DEFAULT 'Emergency lockdown activated'
)
RETURNS jsonb AS $$
DECLARE
    affected_count integer;
BEGIN
    -- Only admins can trigger emergency lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Insert or update emergency lockdown config
    INSERT INTO public.security_config (config_key, config_value)
    VALUES (
        'emergency_lockdown',
        jsonb_build_object(
            'enabled', true,
            'activated_at', now(),
            'activated_by', auth.uid(),
            'reason', _reason
        )
    )
    ON CONFLICT (config_key) 
    DO UPDATE SET 
        config_value = jsonb_build_object(
            'enabled', true,
            'activated_at', now(),
            'activated_by', auth.uid(),
            'reason', _reason
        ),
        updated_at = now();
    
    -- Terminate all active trade secret sessions
    UPDATE public.trade_secret_access_sessions
    SET is_active = false,
        terminated_at = now(),
        terminated_reason = 'emergency_lockdown'
    WHERE is_active = true;
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    -- Log the emergency lockdown
    INSERT INTO public.security_alerts (
        alert_type,
        severity,
        details
    ) VALUES (
        'emergency_lockdown_activated',
        'critical',
        jsonb_build_object(
            'activated_by', auth.uid(),
            'reason', _reason,
            'sessions_terminated', affected_count,
            'timestamp', now()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Emergency lockdown activated',
        'sessions_terminated', affected_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;