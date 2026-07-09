-- Create has_financial_access() function with admin override
-- Admin role always has full access to all modules including financial data

CREATE OR REPLACE FUNCTION public.has_financial_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin role has FULL access to ALL modules - no restrictions
  -- production_manager also has financial access
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'production_manager')
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_financial_access() TO authenticated;