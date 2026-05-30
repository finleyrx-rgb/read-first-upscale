
DROP POLICY IF EXISTS "Concept renders are publicly readable" ON storage.objects;

CREATE POLICY "Owners can list own concept renders"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'concept-renders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
