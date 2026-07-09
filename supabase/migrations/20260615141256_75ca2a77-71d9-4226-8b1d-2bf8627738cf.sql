
-- 1. graph_tokens: explicit service_role-only access (RLS already enabled, no policies)
DO $pol$ BEGIN DROP POLICY IF EXISTS "graph_tokens_service_role_only" ON public.graph_tokens; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "graph_tokens_service_role_only"
ON public.graph_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. customer_inquiries: restrict customer inserts to their own customer_id; allow customers to view their own
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can submit inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can submit inquiries scoped to themselves" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can submit inquiries scoped to themselves"
ON public.customer_inquiries
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Staff (non-customer) can submit on behalf with any customer_id
    NOT has_role(auth.uid(), 'customer'::app_role)
    -- Customers may only insert rows tied to their own customer_id
    OR customer_id = public.get_my_customer_id()
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers can view their own inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Customers can view their own inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Customers can view their own inquiries"
ON public.customer_inquiries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'customer'::app_role)
  AND customer_id IS NOT NULL
  AND customer_id = public.get_my_customer_id()
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. inventory_update_sessions / items: replace invalid 'manager' string with proper has_role() checks
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own sessions" ON public.inventory_update_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own sessions" ON public.inventory_update_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own sessions"
ON public.inventory_update_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.inventory_update_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.inventory_update_sessions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete their own sessions"
ON public.inventory_update_sessions
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view session items" ON public.inventory_update_session_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view session items" ON public.inventory_update_session_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view session items"
ON public.inventory_update_session_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inventory_update_sessions s
    WHERE s.id = inventory_update_session_items.session_id
      AND (
        s.created_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'production_manager'::app_role)
        OR has_role(auth.uid(), 'quality_manager'::app_role)
      )
  )
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 4. office_supply_requests: restrict SELECT/DELETE/UPDATE so customer-role users don't see internal staff PII
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff and requesters can view requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff and requesters can view requests"
ON public.office_supply_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = requested_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
  OR has_role(auth.uid(), 'rd_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff and requesters can delete requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff and requesters can delete requests"
ON public.office_supply_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() = requested_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update their own or all requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Staff and requesters can update requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Staff and requesters can update requests"
ON public.office_supply_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = requested_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  auth.uid() = requested_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
