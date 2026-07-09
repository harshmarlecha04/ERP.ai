-- CRITICAL FIX: Secure Purchase Orders Financial Data Access
-- Replace dangerous "any authenticated user" policy with role-based access control

-- 1. Drop the existing insecure policy
DROP POLICY IF EXISTS "Authenticated users can manage purchase orders" ON public.purchase_orders;

-- 2. Create secure role-based policies for purchase orders
-- Only admin and production_manager should access financial purchasing data
CREATE POLICY "Only authorized personnel can view purchase orders" 
ON public.purchase_orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only authorized personnel can create purchase orders" 
ON public.purchase_orders 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only authorized personnel can update purchase orders" 
ON public.purchase_orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only admins can delete purchase orders" 
ON public.purchase_orders 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create audit logging for financial data access
CREATE OR REPLACE FUNCTION public.log_purchase_order_access(
    _user_id uuid,
    _po_id uuid,
    _access_type text,
    _details jsonb DEFAULT '{}'::jsonb
) RETURNS void AS $$
DECLARE
    user_ip inet;
    risk_level text := 'medium';
BEGIN
    -- Get user IP address
    user_ip := inet_client_addr();
    
    -- Assess risk level - financial data access is always at least medium risk
    risk_level := CASE 
        WHEN _access_type IN ('delete', 'bulk_export', 'financial_report') THEN 'high'
        WHEN _access_type IN ('update', 'create') THEN 'medium'
        ELSE 'medium'  -- Even viewing financial data is medium risk
    END;
    
    -- Log to audit table (reusing formula_access_audit for financial audit trail)
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id, -- We'll use this field to store PO ID for financial audit events
        access_type,
        details,
        risk_level,
        ip_address,
        user_agent,
        session_id
    ) VALUES (
        _user_id,
        _po_id, -- Using formula_id field to store PO ID
        'financial_' || _access_type,
        _details || jsonb_build_object(
            'data_type', 'purchase_order',
            'timestamp', now(),
            'ip_address', user_ip
        ),
        risk_level,
        user_ip,
        current_setting('request.headers', true)::jsonb->>'user-agent',
        current_setting('request.jwt.claims', true)::jsonb->>'session_id'
    );
    
    -- Create security alert for high-risk financial access
    IF risk_level = 'high' THEN
        INSERT INTO public.security_alerts (
            alert_type,
            severity,
            details
        ) VALUES (
            'high_risk_financial_access',
            'high',
            jsonb_build_object(
                'user_id', _user_id,
                'po_id', _po_id,
                'access_type', _access_type,
                'ip_address', user_ip,
                'timestamp', now()
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create trigger for automatic audit logging
CREATE OR REPLACE FUNCTION public.audit_purchase_order_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log INSERT operations (creating purchase orders)
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_purchase_order_access(
            auth.uid(),
            NEW.id,
            'create',
            jsonb_build_object(
                'operation', 'INSERT',
                'po_number', NEW.po_number,
                'vendor_name', NEW.vendor_name,
                'invoice_total', NEW.invoice_total
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log UPDATE operations (modifying financial data)
    IF TG_OP = 'UPDATE' THEN
        PERFORM public.log_purchase_order_access(
            auth.uid(),
            NEW.id,
            'update',
            jsonb_build_object(
                'operation', 'UPDATE',
                'po_number', NEW.po_number,
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each_text(to_jsonb(NEW))
                    WHERE key IN ('invoice_total', 'vendor_name', 'terms', 'status', 'quantity')
                    AND to_jsonb(OLD)->>key IS DISTINCT FROM value
                )
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log DELETE operations (removing purchase orders)
    IF TG_OP = 'DELETE' THEN
        PERFORM public.log_purchase_order_access(
            auth.uid(),
            OLD.id,
            'delete',
            jsonb_build_object(
                'operation', 'DELETE',
                'po_number', OLD.po_number,
                'vendor_name', OLD.vendor_name,
                'invoice_total', OLD.invoice_total
            )
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create the audit trigger
CREATE TRIGGER audit_purchase_order_operations
    AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_purchase_order_access();