-- Fix security issues with correct role names and function search paths

-- 1. Fix suppliers table RLS policies (use production_manager instead of procurement)
-- First check if suppliers table exists and enable RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suppliers' AND table_schema = 'public') THEN
    ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing permissive policies
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.suppliers;
    DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.suppliers;
    DROP POLICY IF EXISTS "Only admins and production managers can manage suppliers" ON public.suppliers;
    DROP POLICY IF EXISTS "Procurement and finance can view suppliers" ON public.suppliers;
    
    -- Create secure policies for suppliers using correct roles
    CREATE POLICY "Admins and production managers can manage suppliers" 
    ON public.suppliers 
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'production_manager')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'production_manager')
    ));

    CREATE POLICY "Production staff can view suppliers for materials" 
    ON public.suppliers 
    FOR SELECT 
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'production_manager', 'quality_manager')
    ));
  END IF;
END $$;

-- 2. Fix security_config table RLS policies (admin only)
-- Ensure security_config table exists
CREATE TABLE IF NOT EXISTS public.security_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and create admin-only policies
DO $rls$ BEGIN ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Enable read access for all users" ON public.security_config; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.security_config; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can access security config" ON public.security_config; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can manage security config" ON public.security_config; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can manage security config" 
ON public.security_config 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. Fix function search path issues for all functions that don't have it set
-- List of functions that need search_path fixed:
-- (removed: citext extension internals; superuser-only and provided by CREATE EXTENSION citext)

-- (removed: citext extension internals; superuser-only and provided by CREATE EXTENSION citext)

-- (removed: citext extension internals; superuser-only and provided by CREATE EXTENSION citext)

-- 4. Ensure emergency lockdown config exists with proper security
INSERT INTO public.security_config (config_key, config_value, description)
VALUES (
  'emergency_lockdown',
  '{"enabled": false}',
  'Emergency lockdown mode for security incidents'
) ON CONFLICT (config_key) DO NOTHING;

-- 5. Fix profiles table - already has proper RLS from previous migration
-- The profiles table already has the secure RLS policies from earlier migration