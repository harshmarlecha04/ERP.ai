
DROP POLICY IF EXISTS "All authenticated users can view profile access audit" ON public.profile_access_audit;

CREATE POLICY "Only admins can view profile access audit"
ON public.profile_access_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
