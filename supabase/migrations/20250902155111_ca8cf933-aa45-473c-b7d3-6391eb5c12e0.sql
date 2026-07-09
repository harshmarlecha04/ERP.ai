-- Update RLS policies for purchase_orders to allow all authenticated users

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Secure PO view access" ON public.purchase_orders;
DROP POLICY IF EXISTS "Secure PO create access" ON public.purchase_orders;
DROP POLICY IF EXISTS "Secure PO update access" ON public.purchase_orders;
DROP POLICY IF EXISTS "Secure PO delete access" ON public.purchase_orders;

-- Create new policies allowing all authenticated users
CREATE POLICY "All authenticated users can view purchase orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create purchase orders"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update purchase orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can delete purchase orders"
ON public.purchase_orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));