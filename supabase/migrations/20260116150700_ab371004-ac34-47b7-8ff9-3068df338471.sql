-- Fix order_line_items public read policy - restrict to authenticated users with proper roles
-- Create restrictive SELECT policy for order_line_items
CREATE POLICY "Authorized roles can view line items"
ON public.order_line_items FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'production_manager'::public.app_role) OR
    public.has_role(auth.uid(), 'quality_manager'::public.app_role) OR
    public.has_role(auth.uid(), 'user'::public.app_role)
);