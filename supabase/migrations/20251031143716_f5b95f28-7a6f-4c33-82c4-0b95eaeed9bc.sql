-- Add time-based SELECT policy to allow anonymous users to view recently created order details
-- This solves the RLS issue where INSERT requires SELECT permission
DO $pol$ BEGIN DROP POLICY IF EXISTS "Allow viewing recently created order details" ON inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Allow viewing recently created order details"
ON inquiry_order_details
FOR SELECT
TO anon, authenticated
USING (
  created_at > (NOW() - INTERVAL '2 minutes')
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;