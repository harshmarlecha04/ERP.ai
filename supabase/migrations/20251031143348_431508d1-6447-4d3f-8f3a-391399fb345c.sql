-- Add time-based SELECT policy to allow anonymous users to view recently created messages
-- This solves the RLS issue where INSERT requires SELECT permission
DO $pol$ BEGIN DROP POLICY IF EXISTS "Allow viewing recently created messages" ON inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Allow viewing recently created messages"
ON inquiry_messages
FOR SELECT
TO anon, authenticated
USING (
  created_at > (NOW() - INTERVAL '2 minutes')
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;