-- Add time-based SELECT policy to allow anonymous users to view recently created inquiries
-- This solves the RLS issue where INSERT requires SELECT permission
CREATE POLICY "Allow viewing recently created inquiries"
ON customer_inquiries
FOR SELECT
TO anon, authenticated
USING (
  created_at > (NOW() - INTERVAL '2 minutes')
);