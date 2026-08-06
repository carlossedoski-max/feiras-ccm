CREATE POLICY "Authenticated can read fair files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fair-files');
CREATE POLICY "Authenticated can upload fair files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fair-files');
CREATE POLICY "Authenticated can update fair files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fair-files') WITH CHECK (bucket_id = 'fair-files');
CREATE POLICY "Authenticated can delete fair files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fair-files');