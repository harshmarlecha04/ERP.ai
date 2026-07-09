-- ============================================================================
-- COMPREHENSIVE SECURITY FIX FOR PROPRIETARY FORMULAS
-- Addresses: Proprietary Formulas Could Be Stolen by Competitors
-- ============================================================================

-- First, let's create the missing get_accessible_formulas function with enhanced security
CREATE OR REPLACE FUNCTION public.get_accessible_formulas(_user_id uuid)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  formula_code text,
  default_batch_size_kg numeric,
  recipe_json jsonb,
  active_ingredients_json jsonb,
  classification_level text,
  security_level text,
  version text,
  yield_uom text,
  notes text,
  is_deleted boolean,
  product_code_line text,
  average_piece_weight numeric,
  total_pieces integer,
  procedure_text text,
  status text,
  requires_approval boolean,
  last_accessed_at timestamptz,
  access_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
    user_has_admin_role boolean := false;
    user_has_rd_manager_role boolean := false;
    user_has_prod_manager_role boolean := false;
    current_time timestamptz := now();
BEGIN
    -- Strict authentication check
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: User ID cannot be null';
    END IF;
    
    -- Check user roles efficiently in a single query
    SELECT 
        bool_or(role = 'admin') as has_admin,
        bool_or(role = 'rd_manager') as has_rd_manager,
        bool_or(role = 'production_manager') as has_prod_manager
    INTO user_has_admin_role, user_has_rd_manager_role, user_has_prod_manager_role
    FROM public.user_roles 
    WHERE user_id = _user_id;
    
    -- Log access attempt for security monitoring
    INSERT INTO public.formula_access_audit (
        user_id, access_type, details, accessed_at, risk_level
    ) VALUES (
        _user_id, 
        'formula_list_access', 
        jsonb_build_object(
            'user_roles', jsonb_build_object(
                'admin', user_has_admin_role,
                'rd_manager', user_has_rd_manager_role,
                'production_manager', user_has_prod_manager_role
            ),
            'access_time', current_time
        ),
        current_time,
        'medium'
    );
    
    -- Return formulas based on strict security rules
    RETURN QUERY
    SELECT 
        f.id,
        f.code,
        f.name,
        f.formula_code,
        f.default_batch_size_kg,
        -- Sanitize sensitive data based on security level and user access
        CASE 
            WHEN f.security_level = 'trade_secret' AND NOT (user_has_admin_role OR user_has_rd_manager_role) THEN
                '[]'::jsonb  -- Hide recipe for unauthorized users
            WHEN f.security_level = 'confidential' AND NOT (user_has_admin_role OR user_has_rd_manager_role) THEN
                -- Allow production managers limited access to confidential recipes during business hours only
                CASE 
                    WHEN user_has_prod_manager_role AND public.is_business_hours() THEN f.recipe_json
                    ELSE '[]'::jsonb
                END
            ELSE f.recipe_json
        END as recipe_json,
        -- Similarly sanitize active ingredients
        CASE 
            WHEN f.security_level = 'trade_secret' AND NOT (user_has_admin_role OR user_has_rd_manager_role) THEN
                '[]'::jsonb
            WHEN f.security_level = 'confidential' AND NOT (user_has_admin_role OR user_has_rd_manager_role) THEN
                CASE 
                    WHEN user_has_prod_manager_role AND public.is_business_hours() THEN f.active_ingredients_json
                    ELSE '[]'::jsonb
                END
            ELSE f.active_ingredients_json
        END as active_ingredients_json,
        f.classification_level,
        f.security_level,
        f.version,
        f.yield_uom,
        f.notes,
        f.is_deleted,
        f.product_code_line,
        f.average_piece_weight,
        f.total_pieces,
        -- Sanitize procedure text for trade secrets
        CASE 
            WHEN f.security_level = 'trade_secret' AND NOT (user_has_admin_role OR user_has_rd_manager_role) THEN
                '[CLASSIFIED - Access Restricted]'
            ELSE f.procedure_text
        END as procedure_text,
        f.status,
        f.requires_approval,
        f.last_accessed_at,
        f.access_count,
        f.created_at,
        f.updated_at
    FROM public.formulas f
    WHERE 
        f.is_deleted = false
        AND (
            -- Trade secret formulas: Only admin and R&D managers
            (f.security_level = 'trade_secret' AND (user_has_admin_role OR user_has_rd_manager_role))
            OR
            -- Confidential formulas: Admin, R&D managers, and production managers during business hours
            (f.security_level = 'confidential' AND (
                user_has_admin_role 
                OR user_has_rd_manager_role 
                OR (user_has_prod_manager_role AND public.is_business_hours())
            ))
            OR
            -- Standard formulas: Admin, R&D managers, and production managers
            (f.security_level = 'standard' AND (
                user_has_admin_role 
                OR user_has_rd_manager_role 
                OR user_has_prod_manager_role
            ))
            OR
            -- Default case for formulas without security level set
            (f.security_level IS NULL AND (
                user_has_admin_role 
                OR user_has_rd_manager_role 
                OR user_has_prod_manager_role
            ))
        )
    ORDER BY 
        f.security_level DESC,  -- Trade secrets first
        f.created_at DESC;
END;
$$;

-- Create enhanced session management for trade secret access
CREATE TABLE IF NOT EXISTS public.trade_secret_access_sessions_enhanced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    formula_id uuid NOT NULL,
    session_token text NOT NULL UNIQUE,
    ip_address inet,
    user_agent text,
    started_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    terminated_at timestamptz,
    terminated_reason text,
    access_level text NOT NULL DEFAULT 'view', -- 'view', 'edit', 'full'
    approval_required boolean DEFAULT true,
    approved_by uuid,
    approved_at timestamptz,
    justification text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on the new sessions table
ALTER TABLE public.trade_secret_access_sessions_enhanced ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the enhanced sessions table
CREATE POLICY "Users can view their own trade secret sessions"
ON public.trade_secret_access_sessions_enhanced
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage trade secret sessions"
ON public.trade_secret_access_sessions_enhanced
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create function to request trade secret access
CREATE OR REPLACE FUNCTION public.request_trade_secret_access(
    _formula_id uuid,
    _justification text,
    _access_level text DEFAULT 'view'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
    requester_id uuid := auth.uid();
    formula_security_level text;
    session_id uuid;
    session_token text;
    expires_at timestamptz;
BEGIN
    -- Validate user authentication
    IF requester_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Check if formula exists and get its security level
    SELECT security_level INTO formula_security_level
    FROM public.formulas 
    WHERE id = _formula_id AND is_deleted = false;
    
    IF formula_security_level IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Formula not found');
    END IF;
    
    -- Only allow requests for trade secret formulas
    IF formula_security_level != 'trade_secret' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access requests only required for trade secret formulas');
    END IF;
    
    -- Check if user already has an active session
    IF EXISTS (
        SELECT 1 FROM public.trade_secret_access_sessions_enhanced
        WHERE user_id = requester_id 
        AND formula_id = _formula_id 
        AND is_active = true 
        AND expires_at > now()
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active session already exists');
    END IF;
    
    -- Generate session token and set expiry (24 hours for trade secrets)
    session_token := encode(gen_random_bytes(32), 'hex');
    expires_at := now() + interval '24 hours';
    
    -- Create access request session
    INSERT INTO public.trade_secret_access_sessions_enhanced (
        user_id,
        formula_id,
        session_token,
        ip_address,
        user_agent,
        expires_at,
        access_level,
        justification,
        approval_required
    ) VALUES (
        requester_id,
        _formula_id,
        session_token,
        inet_client_addr(),
        current_setting('request.header.user-agent', true),
        expires_at,
        _access_level,
        _justification,
        true
    ) RETURNING id INTO session_id;
    
    -- Log the access request for audit
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id,
        access_type,
        details,
        risk_level
    ) VALUES (
        requester_id,
        _formula_id,
        'trade_secret_access_requested',
        jsonb_build_object(
            'session_id', session_id,
            'access_level', _access_level,
            'justification', _justification,
            'ip_address', inet_client_addr()
        ),
        'high'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'session_id', session_id,
        'message', 'Trade secret access request created. Admin approval required.',
        'expires_at', expires_at
    );
END;
$$;

-- Create function for admins to approve trade secret access
CREATE OR REPLACE FUNCTION public.approve_trade_secret_access(
    _session_id uuid,
    _approved boolean DEFAULT true,
    _denial_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
    approver_id uuid := auth.uid();
    session_record record;
BEGIN
    -- Only admins can approve
    IF NOT has_role(approver_id, 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only administrators can approve access requests');
    END IF;
    
    -- Get session details
    SELECT * INTO session_record
    FROM public.trade_secret_access_sessions_enhanced
    WHERE id = _session_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found');
    END IF;
    
    -- Update session approval status
    IF _approved THEN
        UPDATE public.trade_secret_access_sessions_enhanced
        SET 
            approved_by = approver_id,
            approved_at = now(),
            approval_required = false,
            updated_at = now()
        WHERE id = _session_id;
        
        -- Log approval
        INSERT INTO public.formula_access_audit (
            user_id,
            formula_id,
            access_type,
            details,
            risk_level
        ) VALUES (
            approver_id,
            session_record.formula_id,
            'trade_secret_access_approved',
            jsonb_build_object(
                'session_id', _session_id,
                'approved_for_user', session_record.user_id,
                'access_level', session_record.access_level
            ),
            'critical'
        );
        
        RETURN jsonb_build_object('success', true, 'message', 'Access approved');
    ELSE
        UPDATE public.trade_secret_access_sessions_enhanced
        SET 
            is_active = false,
            terminated_at = now(),
            terminated_reason = COALESCE(_denial_reason, 'Access denied by administrator'),
            updated_at = now()
        WHERE id = _session_id;
        
        -- Log denial
        INSERT INTO public.formula_access_audit (
            user_id,
            formula_id,
            access_type,
            details,
            risk_level
        ) VALUES (
            approver_id,
            session_record.formula_id,
            'trade_secret_access_denied',
            jsonb_build_object(
                'session_id', _session_id,
                'denied_for_user', session_record.user_id,
                'denial_reason', _denial_reason
            ),
            'medium'
        );
        
        RETURN jsonb_build_object('success', true, 'message', 'Access denied');
    END IF;
END;
$$;

-- Enhanced formula access validation function
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(
    _user_id uuid,
    _formula_id uuid,
    _access_type text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
    formula_security_level text;
    user_has_admin boolean := false;
    user_has_rd_manager boolean := false;
    user_has_prod_manager boolean := false;
    has_active_session boolean := false;
    current_hour integer;
BEGIN
    -- Get formula security level
    SELECT security_level INTO formula_security_level
    FROM public.formulas
    WHERE id = _formula_id AND is_deleted = false;
    
    IF formula_security_level IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check user roles
    SELECT 
        bool_or(role = 'admin'),
        bool_or(role = 'rd_manager'),
        bool_or(role = 'production_manager')
    INTO user_has_admin, user_has_rd_manager, user_has_prod_manager
    FROM public.user_roles
    WHERE user_id = _user_id;
    
    -- Trade secret formulas require special handling
    IF formula_security_level = 'trade_secret' THEN
        -- Only admin and rd_manager roles can access trade secrets
        IF NOT (user_has_admin OR user_has_rd_manager) THEN
            RETURN false;
        END IF;
        
        -- Check for active approved session
        SELECT EXISTS (
            SELECT 1 FROM public.trade_secret_access_sessions_enhanced
            WHERE user_id = _user_id
            AND formula_id = _formula_id
            AND is_active = true
            AND expires_at > now()
            AND approval_required = false
            AND approved_at IS NOT NULL
        ) INTO has_active_session;
        
        -- Trade secrets require active approved sessions
        IF NOT has_active_session THEN
            -- Log unauthorized access attempt
            INSERT INTO public.formula_access_audit (
                user_id, formula_id, access_type, details, risk_level
            ) VALUES (
                _user_id, _formula_id, 'unauthorized_trade_secret_attempt',
                jsonb_build_object('reason', 'no_active_session'), 'critical'
            );
            RETURN false;
        END IF;
    END IF;
    
    -- Confidential formulas - restricted during off hours for production managers
    IF formula_security_level = 'confidential' THEN
        IF user_has_admin OR user_has_rd_manager THEN
            RETURN true;
        END IF;
        
        -- Production managers can only access during business hours
        IF user_has_prod_manager THEN
            RETURN public.is_business_hours();
        END IF;
        
        RETURN false;
    END IF;
    
    -- Standard formulas - normal role-based access
    IF formula_security_level = 'standard' THEN
        RETURN (user_has_admin OR user_has_rd_manager OR user_has_prod_manager);
    END IF;
    
    -- Default deny
    RETURN false;
END;
$$;

-- Update the existing RLS policy to use the enhanced validation
DROP POLICY IF EXISTS "strict_formula_access_policy" ON public.formulas;

CREATE POLICY "enhanced_secure_formula_access_policy"
ON public.formulas
FOR SELECT
USING (
    NOT is_deleted AND 
    public.validate_formula_access_secure(auth.uid(), id, 'view')
);

-- Create audit trigger for formula access
CREATE OR REPLACE FUNCTION public.audit_formula_access_enhanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
BEGIN
    -- Log all access to formulas
    INSERT INTO public.formula_access_audit (
        user_id,
        formula_id,
        access_type,
        details,
        risk_level,
        ip_address
    ) VALUES (
        auth.uid(),
        NEW.id,
        'formula_access',
        jsonb_build_object(
            'formula_code', NEW.code,
            'security_level', NEW.security_level,
            'classification_level', NEW.classification_level,
            'access_time', now()
        ),
        CASE NEW.security_level
            WHEN 'trade_secret' THEN 'critical'
            WHEN 'confidential' THEN 'high'
            ELSE 'medium'
        END,
        inet_client_addr()
    );
    
    -- Update access tracking
    UPDATE public.formulas
    SET 
        access_count = COALESCE(access_count, 0) + 1,
        last_accessed_at = now()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create the trigger for formula access auditing
CREATE TRIGGER formula_access_audit_trigger
    AFTER SELECT ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_formula_access_enhanced();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_trade_secret_sessions_enhanced()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
BEGIN
    -- Terminate expired sessions
    UPDATE public.trade_secret_access_sessions_enhanced
    SET 
        is_active = false,
        terminated_reason = 'expired',
        terminated_at = now(),
        updated_at = now()
    WHERE is_active = true 
    AND expires_at < now();
    
    -- Clean up old audit logs (keep 2 years for compliance)
    DELETE FROM public.formula_access_audit 
    WHERE accessed_at < now() - interval '2 years';
    
    -- Clean up old sessions (keep 1 year)
    DELETE FROM public.trade_secret_access_sessions_enhanced 
    WHERE (terminated_at < now() - interval '1 year') 
    OR (created_at < now() - interval '1 year' AND terminated_at IS NULL);
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_accessible_formulas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_trade_secret_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_trade_secret_access(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_formula_access_secure(uuid, uuid, text) TO authenticated;