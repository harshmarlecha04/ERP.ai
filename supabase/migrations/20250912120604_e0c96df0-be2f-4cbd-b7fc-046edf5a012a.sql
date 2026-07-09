-- Fix the audit function to handle null user_id during signup
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
    table_operation text;
    record_data jsonb;
BEGIN
    -- Safely determine user_id, skip if null to prevent signup failures
    current_user_id := auth.uid();
    
    -- If auth.uid() is null (during signup), try to get from the record
    IF current_user_id IS NULL THEN
        -- For user_roles table, get from NEW.user_id
        IF TG_TABLE_NAME = 'user_roles' THEN
            current_user_id := NEW.user_id;
        -- For other tables, try common user_id patterns
        ELSIF TG_OP = 'INSERT' AND NEW IS NOT NULL THEN
            current_user_id := COALESCE(
                (to_jsonb(NEW)->>'user_id')::uuid,
                (to_jsonb(NEW)->>'created_by')::uuid,
                (to_jsonb(NEW)->>'id')::uuid
            );
        END IF;
    END IF;
    
    -- If we still don't have a user_id, skip logging to prevent signup failure
    IF current_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Determine operation details
    table_operation := TG_OP;
    
    -- Prepare record data based on operation
    IF TG_OP = 'INSERT' THEN
        record_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        record_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        record_data := to_jsonb(OLD);
        current_user_id := COALESCE(current_user_id, (to_jsonb(OLD)->>'user_id')::uuid);
    END IF;
    
    -- Only log if we have a valid user_id
    IF current_user_id IS NOT NULL THEN
        INSERT INTO public.user_activity_audit (
            user_id,
            activity_type,
            operation,
            table_name,
            record_id,
            old_values,
            new_values,
            details,
            ip_address,
            risk_level
        ) VALUES (
            current_user_id,
            TG_TABLE_NAME,
            table_operation,
            TG_TABLE_NAME,
            COALESCE(
                (record_data->>'id')::text,
                (to_jsonb(NEW)->>'id')::text,
                (to_jsonb(OLD)->>'id')::text
            ),
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
            jsonb_build_object(
                'operation', table_operation,
                'table', TG_TABLE_NAME,
                'timestamp', now()
            ),
            inet_client_addr(),
            CASE 
                WHEN TG_TABLE_NAME IN ('employee_sensitive_data', 'employee_critical_data') THEN 'high'
                WHEN TG_TABLE_NAME IN ('formulas', 'user_roles') THEN 'medium'
                ELSE 'low'
            END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the original operation
        RAISE WARNING 'Audit logging failed: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update any existing triggers to use the safe function
-- Remove and recreate triggers on critical tables to ensure they use the updated function

-- Check if there are existing audit triggers and update them
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS audit_formulas ON public.formulas;

-- Create safe audit triggers that won't break signup
CREATE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();

CREATE TRIGGER audit_profiles  
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();

CREATE TRIGGER audit_formulas
    AFTER INSERT OR UPDATE OR DELETE ON public.formulas  
    FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();