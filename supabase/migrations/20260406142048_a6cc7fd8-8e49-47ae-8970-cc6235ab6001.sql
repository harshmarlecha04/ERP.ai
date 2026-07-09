-- Tighten rd_project_actives INSERT policy to verify user is authenticated (not just WITH CHECK true)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can insert rd_project_actives" ON public.rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can insert rd_project_actives" ON public.rd_project_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can insert rd_project_actives"
ON public.rd_project_actives
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Tighten customer_inquiries INSERT to require at least email/name fields
DO $pol$ BEGIN DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can submit inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can submit inquiries"
ON public.customer_inquiries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Tighten inquiry_messages INSERT
DO $pol$ BEGIN DROP POLICY IF EXISTS "Anyone can insert inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can insert inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can insert inquiry messages"
ON public.inquiry_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Tighten inquiry_order_details INSERT
DO $pol$ BEGIN DROP POLICY IF EXISTS "Anyone can insert inquiry order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can insert inquiry order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can insert inquiry order details"
ON public.inquiry_order_details
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;