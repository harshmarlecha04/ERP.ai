-- Update RLS policies to allow all authenticated users access to all features

-- Purchase Orders - Allow all authenticated users
DROP POLICY IF EXISTS "Only authorized roles can view purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only authorized roles can create purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only authorized roles can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only admins can delete purchase orders" ON public.purchase_orders;

CREATE POLICY "All authenticated users can manage purchase orders"
ON public.purchase_orders
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Formulas - Allow all authenticated users (remove granular access control)
DROP POLICY IF EXISTS "Granular formula access control" ON public.formulas;
DROP POLICY IF EXISTS "Granular formula update control" ON public.formulas;
DROP POLICY IF EXISTS "Only admin can delete formulas" ON public.formulas;
DROP POLICY IF EXISTS "Only admins can create formulas" ON public.formulas;

CREATE POLICY "All authenticated users can manage formulas"
ON public.formulas
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND NOT is_deleted)
WITH CHECK (auth.uid() IS NOT NULL);

-- User Roles - Allow all authenticated users to view (but keep admin restriction for modifications)
DROP POLICY IF EXISTS "Users can view their own roles and admins can view all" ON public.user_roles;

CREATE POLICY "All authenticated users can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Formula Ingredients - Allow all authenticated users
DROP POLICY IF EXISTS "Only authorized personnel can view formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Only R&D and admin can create formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Only R&D and admin can update formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Only admin can delete formula ingredients" ON public.formula_ingredients;

CREATE POLICY "All authenticated users can manage formula ingredients"
ON public.formula_ingredients
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Security Config - Allow all authenticated users to view
DROP POLICY IF EXISTS "Only admins can view security config" ON public.security_config;

CREATE POLICY "All authenticated users can view security config"
ON public.security_config
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Security Alerts - Allow all authenticated users to view
DROP POLICY IF EXISTS "Only admins can view security alerts" ON public.security_alerts;

CREATE POLICY "All authenticated users can view security alerts"
ON public.security_alerts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Formula User Permissions - Allow all authenticated users to view
DROP POLICY IF EXISTS "Users can view their own formula permissions" ON public.formula_user_permissions;

CREATE POLICY "All authenticated users can view formula permissions"
ON public.formula_user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Employee Sensitive Data - Allow all authenticated users to view
DROP POLICY IF EXISTS "Only admins can view sensitive employee data" ON public.employee_sensitive_data;
DROP POLICY IF EXISTS "Only admins can modify sensitive employee data" ON public.employee_sensitive_data;

CREATE POLICY "All authenticated users can view employee data"
ON public.employee_sensitive_data
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can manage employee data"
ON public.employee_sensitive_data
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles - Simplify profile access (remove admin audit requirement)
DROP POLICY IF EXISTS "Admins have audited access to all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view team profiles with consent" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile data only" ON public.profiles;

CREATE POLICY "All authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Keep existing policies for profile updates and deletes as they are already permissive enough