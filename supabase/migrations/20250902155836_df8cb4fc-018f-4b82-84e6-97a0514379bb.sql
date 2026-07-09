-- Complete remaining RLS policy updates

-- Update formula access audit policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "System can insert audit logs" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view formula access audit" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view formula access audit"
ON public.formula_access_audit
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can insert formula access audit" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can insert formula access audit"
ON public.formula_access_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update profile access audit policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only security admins can view profile audit logs" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "System can insert profile audit logs" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view profile access audit" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view profile access audit"
ON public.profile_access_audit
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can insert profile access audit" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can insert profile access audit"
ON public.profile_access_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update formula access requests policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins and R&D managers can manage access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view formula access requests"
ON public.formula_access_requests
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can insert formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can insert formula access requests"
ON public.formula_access_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can update formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can update formula access requests"
ON public.formula_access_requests
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can delete formula access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can delete formula access requests"
ON public.formula_access_requests
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update formula ingredients policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula ingredients access" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula ingredients delete" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula ingredients insert" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula ingredients update" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view formula ingredients" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view formula ingredients"
ON public.formula_ingredients
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can insert formula ingredients" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can insert formula ingredients"
ON public.formula_ingredients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can update formula ingredients" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can update formula ingredients"
ON public.formula_ingredients
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can delete formula ingredients" ON public.formula_ingredients; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can delete formula ingredients"
ON public.formula_ingredients
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update trade secret access sessions policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "System functions can create sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "System functions can update sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own sessions only" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view trade secret sessions"
ON public.trade_secret_access_sessions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can insert trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can insert trade secret sessions"
ON public.trade_secret_access_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can update trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can update trade secret sessions"
ON public.trade_secret_access_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can delete trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can delete trade secret sessions"
ON public.trade_secret_access_sessions
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;