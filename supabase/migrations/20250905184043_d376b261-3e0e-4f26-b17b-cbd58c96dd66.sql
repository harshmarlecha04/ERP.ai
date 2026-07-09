-- Drop the conflicting functions to resolve overloading issue
DROP FUNCTION IF EXISTS public.can_access_specific_formula(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_access_specific_formula(uuid, uuid, text);

-- Create a single, clean function for formula access validation
CREATE OR REPLACE FUNCTION public.can_access_specific_formula(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Simple access check since all users are now admins
    -- This function validates that the user is authenticated and the formula exists
    
    IF _user_id IS NULL OR _formula_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if formula exists and is not deleted
    IF NOT EXISTS (
        SELECT 1 FROM public.formulas 
        WHERE id = _formula_id AND NOT is_deleted
    ) THEN
        RETURN false;
    END IF;
    
    -- Since all users have admin access now, allow access to all formulas
    RETURN true;
END;
$$;