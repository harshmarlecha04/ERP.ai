-- Fix critical security vulnerability: Restrict security config access to admins only

-- Drop the overly permissive policies I created for security_config
DROP POLICY IF EXISTS "All authenticated users can view security config" ON public.security_config;
DROP POLICY IF EXISTS "All authenticated users can insert security config" ON public.security_config;
DROP POLICY IF EXISTS "All authenticated users can update security config" ON public.security_config;
DROP POLICY IF EXISTS "All authenticated users can delete security config" ON public.security_config;

-- Restore secure policies for security_config table - admin access only
CREATE POLICY "Only admins can view security config"
ON public.security_config
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert security config"
ON public.security_config
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update security config"
ON public.security_config
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete security config"
ON public.security_config
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));