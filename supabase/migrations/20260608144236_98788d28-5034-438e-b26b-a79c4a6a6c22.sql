
CREATE POLICY "Auth read launch attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'launch-attachments');
CREATE POLICY "Auth upload launch attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'launch-attachments');
CREATE POLICY "Auth delete launch attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'launch-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
