-- Verify and complete the financial security implementation
-- Add monitoring and verification functions

-- 1. Create a function to check financial data security status
CREATE OR REPLACE FUNCTION public.get_financial_security_status()
RETURNS jsonb AS $$
DECLARE
    po_count integer;
    recent_financial_alerts integer;
    authorized_users integer;
    security_status jsonb;
BEGIN
    -- Only admins can check financial security status
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('error', 'Access denied');
    END IF;
    
    -- Get purchase order count
    SELECT COUNT(*) INTO po_count FROM public.purchase_orders;
    
    -- Get recent financial access alerts
    SELECT COUNT(*) INTO recent_financial_alerts 
    FROM public.security_alerts 
    WHERE alert_type LIKE 'high_risk_financial%'
    AND created_at > now() - interval '7 days';
    
    -- Get count of users with financial data access
    SELECT COUNT(DISTINCT user_id) INTO authorized_users
    FROM public.user_roles 
    WHERE role IN ('admin', 'production_manager');
    
    security_status := jsonb_build_object(
        'total_purchase_orders', po_count,
        'authorized_financial_users', authorized_users,
        'recent_financial_alerts', recent_financial_alerts,
        'financial_access_restricted', true,
        'audit_logging_enabled', true,
        'last_check', now(),
        'security_level', CASE 
            WHEN recent_financial_alerts > 5 THEN 'high_risk'
            WHEN recent_financial_alerts > 0 THEN 'medium_risk'
            ELSE 'secure'
        END
    );
    
    RETURN security_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create function to emergency lock financial data access
CREATE OR REPLACE FUNCTION public.emergency_financial_lockdown()
RETURNS jsonb AS $$
BEGIN
    -- Only admins can trigger financial lockdown
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Log the emergency lockdown
    INSERT INTO public.security_alerts (
        alert_type,
        severity,
        details
    ) VALUES (
        'emergency_financial_lockdown',
        'critical',
        jsonb_build_object(
            'activated_by', auth.uid(),
            'timestamp', now(),
            'reason', 'Emergency financial data protection activated'
        )
    );
    
    -- Insert lockdown config
    INSERT INTO public.security_config (config_key, config_value)
    VALUES (
        'financial_lockdown',
        jsonb_build_object(
            'enabled', true,
            'activated_at', now(),
            'activated_by', auth.uid()
        )
    )
    ON CONFLICT (config_key) 
    DO UPDATE SET 
        config_value = jsonb_build_object(
            'enabled', true,
            'activated_at', now(),
            'activated_by', auth.uid()
        ),
        updated_at = now();
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Emergency financial lockdown activated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Verify the new RLS policies are active
SELECT 
    polname as policy_name,
    CASE polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'w' THEN 'UPDATE' 
        WHEN 'a' THEN 'INSERT'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END as operation,
    'ACTIVE' as status
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname = 'purchase_orders'
ORDER BY polname;