-- Update all RLS policies to allow all authenticated users full access

-- Update formulas table policies
DROP POLICY IF EXISTS "Only R&D managers and admins can insert formulas" ON public.formulas;
DROP POLICY IF EXISTS "Only admins can delete formulas" ON public.formulas;
DROP POLICY IF EXISTS "Secure formula updates with audit" ON public.formulas;
DROP POLICY IF EXISTS "Trade secret formulas require explicit access" ON public.formulas;

CREATE POLICY "All authenticated users can manage formulas"
ON public.formulas
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND NOT is_deleted)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update user_roles table policies  
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "All authenticated users can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can manage user roles"
ON public.user_roles
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update formula access permissions
DROP POLICY IF EXISTS "Only admins and R&D managers can manage permissions" ON public.formula_access_permissions;
DROP POLICY IF EXISTS "Only admins can view formula access permissions" ON public.formula_access_permissions;

CREATE POLICY "All authenticated users can manage formula access permissions"
ON public.formula_access_permissions
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update formula user permissions
DROP POLICY IF EXISTS "Only admins and R&D managers can manage permissions" ON public.formula_user_permissions;
DROP POLICY IF EXISTS "Users can view their own formula permissions" ON public.formula_user_permissions;

CREATE POLICY "All authenticated users can manage formula user permissions"
ON public.formula_user_permissions
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update security config
DROP POLICY IF EXISTS "Only admins can manage security config" ON public.security_config;

CREATE POLICY "All authenticated users can manage security config"
ON public.security_config
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update security alerts
DROP POLICY IF EXISTS "Only admins can manage security alerts" ON public.security_alerts;

CREATE POLICY "All authenticated users can manage security alerts"
ON public.security_alerts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update formula access audit (keep read-only but allow all users to view)
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.formula_access_audit;

CREATE POLICY "All authenticated users can view audit logs"
ON public.formula_access_audit
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update profile access audit
DROP POLICY IF EXISTS "Only security admins can view profile audit logs" ON public.profile_access_audit;

CREATE POLICY "All authenticated users can view profile audit logs"
ON public.profile_access_audit
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Update formula access requests
DROP POLICY IF EXISTS "Admins and R&D managers can manage access requests" ON public.formula_access_requests;
DROP POLICY IF EXISTS "Users can create access requests" ON public.formula_access_requests;
DROP POLICY IF EXISTS "Users can view their own access requests" ON public.formula_access_requests;

CREATE POLICY "All authenticated users can manage formula access requests"
ON public.formula_access_requests
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update formula ingredients
DROP POLICY IF EXISTS "Strict formula ingredients access" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Strict formula ingredients delete" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Strict formula ingredients insert" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Strict formula ingredients update" ON public.formula_ingredients;

CREATE POLICY "All authenticated users can manage formula ingredients"
ON public.formula_ingredients
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update trade secret access sessions
DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.trade_secret_access_sessions;
DROP POLICY IF EXISTS "System functions can create sessions" ON public.trade_secret_access_sessions;
DROP POLICY IF EXISTS "System functions can update sessions" ON public.trade_secret_access_sessions;
DROP POLICY IF EXISTS "Users can view own sessions only" ON public.trade_secret_access_sessions;

CREATE POLICY "All authenticated users can manage trade secret sessions"
ON public.trade_secret_access_sessions
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);