DROP POLICY IF EXISTS "Authenticated can delete fair files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete project images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read fair files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read project images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update fair files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update project images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload fair files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete supplier files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read supplier files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update supplier files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload supplier files" ON storage.objects;

CREATE POLICY "Team members manage app files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id IN ('fair-files','project-images','supplier-files') AND public.is_team_member(auth.uid()))
WITH CHECK (bucket_id IN ('fair-files','project-images','supplier-files') AND public.is_team_member(auth.uid()));