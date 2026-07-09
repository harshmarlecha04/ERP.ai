-- Fix Formula Security Implementation - Handle Existing Trigger
-- Drop existing trigger and recreate with complete security implementation

-- 1. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;

-- 2. Create formula security validation function (replace existing)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_security_level' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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

-- 3. Recreate the security validation trigger
DROP TRIGGER IF EXISTS formula_security_validation_trigger ON public.formulas;
CREATE TRIGGER formula_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_formula_security_level();

-- 4. Summary comment documenting the complete security implementation
COMMENT ON FUNCTION public.validate_formula_security_level() IS 
'Enhanced formula security validation:
- Enforces trade secret security levels
- Prevents unauthorized classification downgrades
- Implements comprehensive audit logging
- Works with existing RLS policies for defense in depth';

-- 5. Create final security status check function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_security_implementation' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_formula_security_implementation()
RETURNS jsonb AS $$
DECLARE
    rls_enabled boolean;
    triggers_count integer;
    policies_count integer;
    functions_count integer;
    result jsonb;
BEGIN
    -- Check RLS is enabled on formulas table
    SELECT EXISTS(
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'formulas' 
        AND rowsecurity = true
    ) INTO rls_enabled;
    
    -- Count security triggers
    SELECT COUNT(*) INTO triggers_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'formulas' 
    AND t.tgname LIKE '%security%';
    
    -- Count RLS policies
    SELECT COUNT(*) INTO policies_count
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    WHERE c.relname = 'formulas';
    
    -- Count security functions
    SELECT COUNT(*) INTO functions_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname LIKE '%formula%security%';
    
    result := jsonb_build_object(
        'rls_enabled', rls_enabled,
        'security_triggers', triggers_count,
        'rls_policies', policies_count,
        'security_functions', functions_count,
        'status', CASE 
            WHEN rls_enabled AND triggers_count > 0 AND policies_count >= 4 
            THEN 'SECURE' 
            ELSE 'NEEDS_ATTENTION' 
        END,
        'checked_at', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;