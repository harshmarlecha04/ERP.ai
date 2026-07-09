
DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_pdfs_insert_auth" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "coa_pdfs_insert_staff" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "coa_pdfs_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coa-pdfs' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'quality_manager'::app_role)
      OR has_role(auth.uid(), 'production_manager'::app_role)
    )
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers can view their own record" ON public.customers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers can view their own record" ON public.customers
  FOR SELECT TO authenticated
  USING (id = public.get_my_customer_id()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "graph_tokens_own" ON public.graph_tokens; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can view orders" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can view orders" ON public.order_headers
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'production_manager'::app_role)
    OR has_role(auth.uid(), 'quality_manager'::app_role)
    OR has_role(auth.uid(), 'rd_manager'::app_role)
    OR has_role(auth.uid(), 'hr_manager'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can create orders" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can create orders" ON public.order_headers
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'production_manager'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff can update orders" ON public.order_headers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff can update orders" ON public.order_headers
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'production_manager'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'production_manager'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
  ); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_formula_access_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_formula_access_secure(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'view')
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    formula_security_level text;
    user_has_role boolean := false;
    user_has_standard_role boolean := false;
    has_explicit_permission boolean := false;
BEGIN
    SELECT security_level INTO formula_security_level
    FROM public.formulas
    WHERE id = _formula_id AND NOT is_deleted;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    user_has_role := EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'rd_manager')
    );

    user_has_standard_role := user_has_role OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('production_manager', 'quality_manager')
    );

    IF formula_security_level = 'standard' THEN
        RETURN user_has_standard_role;
    END IF;

    has_explicit_permission := EXISTS (
        SELECT 1 FROM public.formula_user_permissions
        WHERE formula_id = _formula_id
        AND user_id = _user_id
        AND permission_type = _access_type
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    );

    IF formula_security_level = 'trade_secret' THEN
        RETURN has_explicit_permission;
    END IF;

    RETURN user_has_role OR has_explicit_permission;
END;
$function$;
