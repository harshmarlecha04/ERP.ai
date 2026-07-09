-- Fix overly permissive RLS policies on trade_secret_access_sessions table
-- Users should only be able to manage their own sessions

-- Drop existing overly permissive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can insert trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can update trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can delete trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create secure policies that restrict access to user's own sessions only
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create their own trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can create their own trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update their own trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can update their own trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete their own trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete their own trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR DELETE 
TO authenticated
USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Add admin override policies for system administration
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can view all trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can view all trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can update all trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can update all trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can delete all trade secret sessions" ON public.trade_secret_access_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins can delete all trade secret sessions" 
ON public.trade_secret_access_sessions 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;