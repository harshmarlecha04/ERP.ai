DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can upload own supplement facts" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can upload own supplement facts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplement-facts' AND (storage.foldername(name))[1] = auth.uid()::text); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can read own supplement facts" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can read own supplement facts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplement-facts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'))); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete own supplement facts" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete own supplement facts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplement-facts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;