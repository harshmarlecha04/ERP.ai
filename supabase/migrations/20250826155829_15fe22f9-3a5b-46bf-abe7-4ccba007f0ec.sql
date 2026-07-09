-- Check and fix the trigger that's causing the conflict
-- First, let's see the current trigger and modify it to avoid conflicts during soft deletes

-- Drop and recreate the trigger as an AFTER trigger to avoid conflicts
DROP TRIGGER IF EXISTS update_formula_access_stats_trigger ON public.formulas;

-- Also update the function to avoid updating during soft deletes
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_formula_access_stats' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_formula_access_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Don't update stats if this is a soft delete operation
    IF TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false THEN
        RETURN NEW;
    END IF;
    
    -- Only update access stats for actual formula access, not during soft deletes
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'formula_access_audit' THEN
        UPDATE public.formulas 
        SET last_accessed_at = now(), 
            access_count = access_count + 1
        WHERE id = NEW.formula_id AND is_deleted = false;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create AFTER trigger on formula_access_audit instead of formulas table
DROP TRIGGER IF EXISTS update_formula_access_stats_trigger ON public.formula_access_audit;
DROP TRIGGER IF EXISTS update_formula_access_stats_trigger ON public.formula_access_audit;
CREATE TRIGGER update_formula_access_stats_trigger
    AFTER INSERT ON public.formula_access_audit
    FOR EACH ROW
    EXECUTE FUNCTION public.update_formula_access_stats();