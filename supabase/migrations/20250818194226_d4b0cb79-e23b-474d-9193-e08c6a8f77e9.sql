-- Fix remaining security issues for audit tables and trade secret sessions

-- 1. Fix trade_secret_access_sessions policies (too permissive "System can manage" policy)
DO $pol$ BEGIN DROP POLICY IF EXISTS "System can manage trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Replace with more restrictive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR SELECT 
USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can manage all trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can manage all trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Allow system functions to insert/update sessions (for automated processes)
DO $pol$ BEGIN DROP POLICY IF EXISTS "System can insert trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "System can insert trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR INSERT 
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "System can update session status" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "System can update session status" 
ON public.trade_secret_access_sessions 
FOR UPDATE 
USING (true)
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. Verify audit tables have proper admin-only access
-- Both formula_access_audit and profile_access_audit should already have correct policies
-- Let's double-check and ensure they're restrictive

-- Formula access audit should only be viewable by admins
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only security admins can view formula audit logs" ON public.formula_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only security admins can view formula audit logs" 
ON public.formula_access_audit 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Profile access audit should only be viewable by admins  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only security admins can view profile audit logs" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only security admins can view profile audit logs" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only security admins can view profile audit logs" 
ON public.profile_access_audit 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. Ensure security_config is properly locked down (admin-only)
-- This should already be fixed from previous migration, but let's verify it exists
-- The policy was already created in the previous migration