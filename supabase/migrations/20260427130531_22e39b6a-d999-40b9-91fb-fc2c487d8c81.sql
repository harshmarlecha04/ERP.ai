
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view profile access audit" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can view profile access audit" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can view profile access audit"
ON public.profile_access_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
