-- Fix security issues for profiles, suppliers, and security_config tables

-- 1. Fix profiles table RLS policies to prevent unauthorized access to employee data
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create secure policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Fix suppliers table RLS policies (restrict to procurement and admin only)
-- First check if suppliers table exists and enable RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suppliers' AND table_schema = 'public') THEN
    ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing permissive policies
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.suppliers;
    DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.suppliers;
    
    -- Create secure policies for suppliers
    CREATE POLICY "Procurement and admins can manage suppliers" 
    ON public.suppliers 
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'procurement')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'procurement')
    ));

    CREATE POLICY "Production can view suppliers for materials" 
    ON public.suppliers 
    FOR SELECT 
    USING (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'procurement', 'production_manager')
    ));
  END IF;
END $$;

-- 3. Fix security_config table RLS policies (admin only)
-- Create security_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and create admin-only policies
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.security_config;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.security_config;

CREATE POLICY "Only admins can access security config" 
ON public.security_config 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- 4. Fix function search path issues for existing functions
CREATE OR REPLACE FUNCTION public.update_formula_access_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.formulas 
    SET last_accessed_at = now(), 
        access_count = access_count + 1
    WHERE id = NEW.formula_id;
    RETURN NEW;
END;
$$;

-- Ensure emergency lockdown config exists
INSERT INTO public.security_config (config_key, config_value, description)
VALUES (
  'emergency_lockdown',
  '{"enabled": false}',
  'Emergency lockdown mode for security incidents'
) ON CONFLICT (config_key) DO NOTHING;