-- Continue updating remaining RLS policies

-- Update formula access permissions
DROP POLICY IF EXISTS "Only admins and R&D managers can manage permissions" ON public.formula_access_permissions;
DROP POLICY IF EXISTS "Only admins can view formula access permissions" ON public.formula_access_permissions;

CREATE POLICY "All authenticated users can view formula access permissions"
ON public.formula_access_permissions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert formula access permissions"
ON public.formula_access_permissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update formula access permissions"
ON public.formula_access_permissions
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete formula access permissions"
ON public.formula_access_permissions
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update formula user permissions
DROP POLICY IF EXISTS "Only admins and R&D managers can manage permissions" ON public.formula_user_permissions;
DROP POLICY IF EXISTS "Users can view their own formula permissions" ON public.formula_user_permissions;

CREATE POLICY "All authenticated users can view formula user permissions"
ON public.formula_user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert formula user permissions"
ON public.formula_user_permissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update formula user permissions"
ON public.formula_user_permissions
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete formula user permissions"
ON public.formula_user_permissions
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update security config
DROP POLICY IF EXISTS "Only admins can manage security config" ON public.security_config;

CREATE POLICY "All authenticated users can view security config"
ON public.security_config
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert security config"
ON public.security_config
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update security config"
ON public.security_config
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete security config"
ON public.security_config
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update security alerts
DROP POLICY IF EXISTS "Only admins can manage security alerts" ON public.security_alerts;

CREATE POLICY "All authenticated users can view security alerts"
ON public.security_alerts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert security alerts"
ON public.security_alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update security alerts"
ON public.security_alerts
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete security alerts"
ON public.security_alerts
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);