-- Drop and recreate security_config policy to fix the conflict
DROP POLICY IF EXISTS "Only admins can manage security config" ON public.security_config;

CREATE POLICY "Only admins can manage security config" 
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