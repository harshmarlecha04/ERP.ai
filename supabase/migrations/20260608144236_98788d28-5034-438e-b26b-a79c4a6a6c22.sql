
DO $pol$ BEGIN DROP POLICY IF EXISTS "Auth read launch attachments" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Auth read launch attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'launch-attachments'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Auth upload launch attachments" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Auth upload launch attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'launch-attachments'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Auth delete launch attachments" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Auth delete launch attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'launch-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin'))); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
