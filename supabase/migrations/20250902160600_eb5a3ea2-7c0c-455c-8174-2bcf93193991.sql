-- Fix security vulnerability: Restrict security alerts access to admins only

-- Drop the overly permissive policies I created for security_alerts
DROP POLICY IF EXISTS "All authenticated users can view security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "All authenticated users can insert security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "All authenticated users can update security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "All authenticated users can delete security alerts" ON public.security_alerts;

-- Restore secure policies for security_alerts table - admin access only
CREATE POLICY "Only admins can view security alerts"
ON public.security_alerts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert security alerts"
ON public.security_alerts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update security alerts" 
ON public.security_alerts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete security alerts"
ON public.security_alerts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));