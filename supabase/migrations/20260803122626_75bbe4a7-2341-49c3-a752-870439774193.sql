CREATE POLICY "Authenticated read supplier files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'supplier-files');
CREATE POLICY "Authenticated upload supplier files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'supplier-files');
CREATE POLICY "Authenticated update supplier files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'supplier-files') WITH CHECK (bucket_id = 'supplier-files');
CREATE POLICY "Authenticated delete supplier files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'supplier-files');