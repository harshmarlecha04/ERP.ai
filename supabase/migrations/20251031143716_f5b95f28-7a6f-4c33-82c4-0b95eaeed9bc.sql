-- Add time-based SELECT policy to allow anonymous users to view recently created order details
-- This solves the RLS issue where INSERT requires SELECT permission
CREATE POLICY "Allow viewing recently created order details"
ON inquiry_order_details
FOR SELECT
TO anon, authenticated
USING (
  created_at > (NOW() - INTERVAL '2 minutes')
);