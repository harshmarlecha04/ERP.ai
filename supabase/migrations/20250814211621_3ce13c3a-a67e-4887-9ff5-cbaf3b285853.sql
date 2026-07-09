-- Rename the misleading policy name for clarity
DROP POLICY "Admins can view all profiles" ON public.profiles;

-- Create a clearer policy name that reflects what it actually does
CREATE POLICY "Users can view own profile, admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role));