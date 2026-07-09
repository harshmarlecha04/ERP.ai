-- Remove logging from SELECT policies to fix read-only transaction errors

-- Update formula RLS policies to remove logging during SELECT
DROP POLICY IF EXISTS "Secure multi-layer formula access" ON public.formulas;
CREATE POLICY "Secure multi-layer formula access" 
ON public.formulas 
FOR SELECT 
USING (
  -- Check basic access without logging
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'rd_manager', 'production_manager')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.formula_access_permissions 
    WHERE user_id = auth.uid() 
    AND formula_id = formulas.id 
    AND permission_type IN ('read', 'write', 'admin')
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  )
);

-- Update formula ingredients RLS policy to remove logging during SELECT
DROP POLICY IF EXISTS "Strict formula ingredients access" ON public.formula_ingredients;
CREATE POLICY "Strict formula ingredients access" 
ON public.formula_ingredients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'rd_manager', 'production_manager')
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.formula_access_permissions 
    WHERE user_id = auth.uid() 
    AND formula_id = formula_ingredients.formula_id 
    AND permission_type IN ('read', 'write', 'admin')
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  )
);

-- Create a simpler function for basic access checking without logging
CREATE OR REPLACE FUNCTION public.can_access_formula_basic(_user_id uuid, _formula_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user has admin/rd_manager role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role IN ('admin', 'rd_manager', 'production_manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.formula_access_permissions 
    WHERE user_id = _user_id 
    AND formula_id = _formula_id 
    AND permission_type IN ('read', 'write', 'admin')
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  )
$$;