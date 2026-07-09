-- First, let me check what the log_formula_access function is doing
CREATE OR REPLACE FUNCTION public.log_formula_access(_user_id uuid, _formula_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.formula_access_audit (
        user_id, formula_id, access_type, details, accessed_at, risk_level
    ) VALUES (
        _user_id, _formula_id, _access_type, _details, now(), 
        CASE 
            WHEN _access_type IN ('admin_access', 'trade_secret_access') THEN 'high'
            WHEN _access_type IN ('access_denied_confidential', 'access_denied_hours') THEN 'medium'
            ELSE 'low'
        END
    );
END;
$function$;

-- Now update the check constraint to include all possible access types
ALTER TABLE formula_access_audit DROP CONSTRAINT IF EXISTS formula_access_audit_access_type_check;

-- Add comprehensive constraint including all access types used in the functions
ALTER TABLE formula_access_audit ADD CONSTRAINT formula_access_audit_access_type_check 
CHECK (access_type IN (
    'view', 'edit', 'delete', 'create', 'update', 'admin_access', 
    'rd_manager_access', 'explicit_permission_access', 'role_based_access',
    'trade_secret_access', 'access_denied_emergency', 'access_denied_hours',
    'access_denied_no_permission', 'access_denied_confidential', 
    'access_denied_general', 'permission_granted', 'access_requested'
));