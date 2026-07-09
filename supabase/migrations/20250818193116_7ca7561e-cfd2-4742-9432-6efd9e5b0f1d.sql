-- Comprehensive Security Fix for Formula Data Protection
-- This migration implements multi-layered access controls with explicit user-formula permission mapping

-- 1. First, let's enhance the formulas table with better security tracking
ALTER TABLE public.formulas 
ADD COLUMN IF NOT EXISTS security_level text DEFAULT 'standard' CHECK (security_level IN ('standard', 'restricted', 'confidential', 'trade_secret')),
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0;

-- Update existing formulas to have proper security levels
UPDATE public.formulas 
SET security_level = CASE 
    WHEN classification_level = 'trade_secret' THEN 'trade_secret'
    WHEN classification_level = 'confidential' THEN 'confidential'
    ELSE 'standard'
END,
requires_approval = CASE 
    WHEN classification_level IN ('trade_secret', 'confidential') THEN true
    ELSE false
END;

-- 2. Create explicit formula access control table with stricter constraints
CREATE TABLE IF NOT EXISTS public.formula_user_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id uuid NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    permission_type text NOT NULL CHECK (permission_type IN ('view', 'edit', 'admin')),
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    access_conditions jsonb DEFAULT '{}',
    approval_count integer DEFAULT 0,
    required_approvals integer DEFAULT 1,
    last_used_at timestamp with time zone,
    usage_count integer DEFAULT 0,
    
    UNIQUE(formula_id, user_id, permission_type)
);

-- Enable RLS on new permissions table
ALTER TABLE public.formula_user_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Create secure access validation function with multiple security layers
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(
    _user_id uuid, 
    _formula_id uuid, 
    _access_type text DEFAULT 'view'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    formula_security_level text;
    user_has_role boolean := false;
    has_explicit_permission boolean := false;
    emergency_mode boolean := false;
    current_time timestamp with time zone := now();
    permission_record record;
    access_hour integer;
BEGIN
    -- Input validation
    IF _user_id IS NULL OR _formula_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for emergency lockdown
    SELECT COALESCE((config_value->>'enabled')::boolean, false) INTO emergency_mode
    FROM public.security_config 
    WHERE config_key = 'emergency_lockdown';
    
    IF emergency_mode THEN
        -- Only allow admins during emergency
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = _user_id AND role = 'admin'
        ) INTO user_has_role;
        
        IF NOT user_has_role THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_emergency', 
                jsonb_build_object('reason', 'emergency_lockdown_active'));
            RETURN false;
        END IF;
    END IF;
    
    -- Get formula security level
    SELECT security_level INTO formula_security_level
    FROM public.formulas 
    WHERE id = _formula_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check if user is admin (admins have access to all formulas)
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role = 'admin'
    ) INTO user_has_role;
    
    IF user_has_role THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'admin_access', 
            jsonb_build_object('access_type', _access_type));
        RETURN true;
    END IF;
    
    -- For trade secret formulas, implement enhanced security
    IF formula_security_level = 'trade_secret' THEN
        -- Check business hours (8 AM to 6 PM)
        access_hour := EXTRACT(hour FROM current_time);
        IF access_hour < 8 OR access_hour >= 18 THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_hours', 
                jsonb_build_object('hour', access_hour));
            RETURN false;
        END IF;
        
        -- Check for valid explicit permission with required approvals
        SELECT * INTO permission_record
        FROM public.formula_user_permissions 
        WHERE formula_id = _formula_id 
        AND user_id = _user_id 
        AND permission_type IN (_access_type, 'admin')
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > current_time)
        AND approval_count >= required_approvals;
        
        IF NOT FOUND THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_no_permission', 
                jsonb_build_object('access_type', _access_type, 'security_level', formula_security_level));
            RETURN false;
        END IF;
        
        -- Update usage tracking
        UPDATE public.formula_user_permissions 
        SET last_used_at = current_time, usage_count = usage_count + 1
        WHERE id = permission_record.id;
        
        PERFORM public.log_formula_access(_user_id, _formula_id, 'trade_secret_access', 
            jsonb_build_object('permission_id', permission_record.id, 'access_type', _access_type));
        RETURN true;
    END IF;
    
    -- For confidential formulas, check for R&D manager role or explicit permission
    IF formula_security_level = 'confidential' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = _user_id AND role = 'rd_manager'
        ) INTO user_has_role;
        
        IF user_has_role THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'rd_manager_access', 
                jsonb_build_object('access_type', _access_type));
            RETURN true;
        END IF;
        
        -- Check explicit permission
        SELECT EXISTS (
            SELECT 1 FROM public.formula_user_permissions 
            WHERE formula_id = _formula_id 
            AND user_id = _user_id 
            AND permission_type IN (_access_type, 'admin', 'edit')
            AND is_active = true
            AND (expires_at IS NULL OR expires_at > current_time)
        ) INTO has_explicit_permission;
        
        IF has_explicit_permission THEN
            PERFORM public.log_formula_access(_user_id, _formula_id, 'explicit_permission_access', 
                jsonb_build_object('access_type', _access_type));
            RETURN true;
        END IF;
        
        PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_confidential', 
            jsonb_build_object('access_type', _access_type));
        RETURN false;
    END IF;
    
    -- For standard formulas, check for any production role or explicit permission
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role IN ('admin', 'rd_manager', 'production_manager')
    ) INTO user_has_role;
    
    IF user_has_role THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'role_based_access', 
            jsonb_build_object('access_type', _access_type));
        RETURN true;
    END IF;
    
    -- Final check for explicit permission
    SELECT EXISTS (
        SELECT 1 FROM public.formula_user_permissions 
        WHERE formula_id = _formula_id 
        AND user_id = _user_id 
        AND permission_type IN (_access_type, 'admin', 'edit')
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > current_time)
    ) INTO has_explicit_permission;
    
    IF has_explicit_permission THEN
        PERFORM public.log_formula_access(_user_id, _formula_id, 'explicit_permission_access', 
            jsonb_build_object('access_type', _access_type));
        RETURN true;
    END IF;
    
    -- Access denied
    PERFORM public.log_formula_access(_user_id, _formula_id, 'access_denied_general', 
        jsonb_build_object('access_type', _access_type, 'security_level', formula_security_level));
    RETURN false;
END;
$$;

-- 4. Create function to grant formula permissions with approval workflow
CREATE OR REPLACE FUNCTION public.grant_formula_permission_secure(
    _formula_id uuid,
    _user_id uuid, 
    _permission_type text,
    _justification text,
    _expires_at timestamp with time zone DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    granter_id uuid := auth.uid();
    formula_security_level text;
    required_approver_count integer := 1;
    result jsonb;
BEGIN
    -- Validate granter permissions
    IF NOT (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = granter_id AND role IN ('admin', 'rd_manager'))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient privileges to grant permissions');
    END IF;
    
    -- Get formula security level to determine approval requirements
    SELECT security_level INTO formula_security_level
    FROM public.formulas WHERE id = _formula_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Formula not found');
    END IF;
    
    -- Set required approvals based on security level
    required_approver_count := CASE 
        WHEN formula_security_level = 'trade_secret' THEN 2
        WHEN formula_security_level = 'confidential' THEN 1
        ELSE 1
    END;
    
    -- Insert or update permission
    INSERT INTO public.formula_user_permissions (
        formula_id, user_id, permission_type, granted_by, expires_at, 
        required_approvals, approval_count
    ) VALUES (
        _formula_id, _user_id, _permission_type, granter_id, _expires_at,
        required_approver_count, 1
    )
    ON CONFLICT (formula_id, user_id, permission_type) 
    DO UPDATE SET 
        granted_by = granter_id,
        granted_at = now(),
        expires_at = _expires_at,
        is_active = true,
        approval_count = GREATEST(formula_user_permissions.approval_count, 1);
    
    -- Log the permission grant
    PERFORM public.log_formula_access(granter_id, _formula_id, 'permission_granted', 
        jsonb_build_object(
            'granted_to', _user_id,
            'permission_type', _permission_type,
            'justification', _justification,
            'security_level', formula_security_level,
            'required_approvals', required_approver_count
        )
    );
    
    RETURN jsonb_build_object(
        'success', true, 
        'permission_id', (SELECT id FROM public.formula_user_permissions 
                         WHERE formula_id = _formula_id AND user_id = _user_id AND permission_type = _permission_type),
        'requires_additional_approval', (required_approver_count > 1)
    );
END;
$$;

-- 5. Update RLS policies to use the new secure validation function
DROP POLICY IF EXISTS "Secure formula access without logging" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula update access" ON public.formulas;

CREATE POLICY "Secure multi-layer formula access" 
ON public.formulas 
FOR SELECT 
USING (public.validate_formula_access_secure(auth.uid(), id, 'view'));

CREATE POLICY "Secure multi-layer formula update" 
ON public.formulas 
FOR UPDATE 
USING (public.validate_formula_access_secure(auth.uid(), id, 'edit'))
WITH CHECK (public.validate_formula_access_secure(auth.uid(), id, 'edit'));

-- 6. Create RLS policies for the new permissions table
CREATE POLICY "Users can view their own formula permissions" 
ON public.formula_user_permissions 
FOR SELECT 
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins and R&D managers can manage permissions" 
ON public.formula_user_permissions 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rd_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rd_manager'));

-- 7. Create trigger to update formula access tracking
CREATE OR REPLACE FUNCTION public.update_formula_access_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.formulas 
    SET last_accessed_at = now(), 
        access_count = access_count + 1
    WHERE id = NEW.formula_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER formula_access_tracking
    AFTER INSERT ON public.formula_access_audit
    FOR EACH ROW
    EXECUTE FUNCTION public.update_formula_access_stats();

-- 8. Insert default security configuration
INSERT INTO public.security_config (config_key, config_value) VALUES 
('trade_secret_access_controls', jsonb_build_object(
    'allowed_access_hours', jsonb_build_object('start', 8, 'end', 18),
    'max_daily_accesses', 3,
    'minimum_approvers', 2,
    'session_timeout_minutes', 30,
    'suspicious_patterns', jsonb_build_object('rapid_access_threshold', 5)
)),
('emergency_lockdown', jsonb_build_object('enabled', false))
ON CONFLICT (config_key) DO UPDATE SET 
config_value = EXCLUDED.config_value,
updated_at = now();