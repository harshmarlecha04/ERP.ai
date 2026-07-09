-- Fix RLS policies to remove INSERT operations during SELECT operations

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
    AND access_type IN ('read', 'write', 'admin')
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
    AND access_type IN ('read', 'write', 'admin')
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update profile RLS policies to remove logging during SELECT  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure profile access with audit trail" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure profile access with audit trail" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure profile access with audit trail" 
ON public.profiles 
FOR SELECT 
USING (
  -- Own profile access
  auth.uid() = id 
  OR 
  -- Admin access without logging
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;