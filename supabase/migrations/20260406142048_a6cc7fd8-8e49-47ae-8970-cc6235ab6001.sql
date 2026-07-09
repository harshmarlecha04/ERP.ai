-- Tighten rd_project_actives INSERT policy to verify user is authenticated (not just WITH CHECK true)
DROP POLICY IF EXISTS "Authenticated users can insert rd_project_actives" ON public.rd_project_actives;
CREATE POLICY "Authenticated users can insert rd_project_actives"
ON public.rd_project_actives
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Tighten customer_inquiries INSERT to require at least email/name fields
DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.customer_inquiries;
CREATE POLICY "Authenticated users can submit inquiries"
ON public.customer_inquiries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Tighten inquiry_messages INSERT
DROP POLICY IF EXISTS "Anyone can insert inquiry messages" ON public.inquiry_messages;
CREATE POLICY "Authenticated users can insert inquiry messages"
ON public.inquiry_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Tighten inquiry_order_details INSERT
DROP POLICY IF EXISTS "Anyone can insert inquiry order details" ON public.inquiry_order_details;
CREATE POLICY "Authenticated users can insert inquiry order details"
ON public.inquiry_order_details
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);