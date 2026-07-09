-- Implement granular formula access control to prevent insider threats

-- First, secure the permission management tables - only admins should manage permissions
DROP POLICY IF EXISTS "All authenticated users can view formula user permissions" ON public.formula_user_permissions;
DROP POLICY IF EXISTS "All authenticated users can insert formula user permissions" ON public.formula_user_permissions;
DROP POLICY IF EXISTS "All authenticated users can update formula user permissions" ON public.formula_user_permissions;
DROP POLICY IF EXISTS "All authenticated users can delete formula user permissions" ON public.formula_user_permissions;

DROP POLICY IF EXISTS "All authenticated users can view formula access permissions" ON public.formula_access_permissions;
DROP POLICY IF EXISTS "All authenticated users can insert formula access permissions" ON public.formula_access_permissions;
DROP POLICY IF EXISTS "All authenticated users can update formula access permissions" ON public.formula_access_permissions;
DROP POLICY IF EXISTS "All authenticated users can delete formula access permissions" ON public.formula_access_permissions;

-- Only admins can manage formula permissions (prevent self-service permission grants)
CREATE POLICY "Only admins can manage formula user permissions"
ON public.formula_user_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own formula permissions"
ON public.formula_user_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage formula access permissions"
ON public.formula_access_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));