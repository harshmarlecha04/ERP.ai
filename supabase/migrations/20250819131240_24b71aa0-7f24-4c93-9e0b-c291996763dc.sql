ALTER TABLE public.formula_access_permissions ADD COLUMN IF NOT EXISTS permission_type text DEFAULT 'read';

-- Remove logging from SELECT policies to fix read-only transaction errors

-- Update formula RLS policies to remove logging during SELECT
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure multi-layer formula access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure multi-layer formula access" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure multi-layer formula access" 
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
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update formula ingredients RLS policy to remove logging during SELECT
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula ingredients access" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula ingredients access" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Strict formula ingredients access" 
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
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create a simpler function for basic access checking without logging
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_formula_basic' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
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