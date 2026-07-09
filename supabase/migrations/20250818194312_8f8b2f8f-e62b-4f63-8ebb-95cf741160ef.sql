-- Clean up and fix trade secret sessions policies properly
DROP POLICY IF EXISTS "Users can view their own trade secret sessions" ON public.trade_secret_access_sessions;
DROP POLICY IF EXISTS "System can manage trade secret sessions" ON public.trade_secret_access_sessions;

-- Create proper restrictive policies
CREATE POLICY "Users can view own sessions only" 
ON public.trade_secret_access_sessions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all sessions" 
ON public.trade_secret_access_sessions 
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- System needs to be able to create/update sessions for security functions
CREATE POLICY "System functions can create sessions" 
ON public.trade_secret_access_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System functions can update sessions" 
ON public.trade_secret_access_sessions 
FOR UPDATE 
USING (true);