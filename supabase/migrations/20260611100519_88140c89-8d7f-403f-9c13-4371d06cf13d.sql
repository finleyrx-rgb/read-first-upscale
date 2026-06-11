
CREATE TABLE public.project_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pdf','image')),
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  page_count integer NOT NULL DEFAULT 1,
  analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_sources TO authenticated;
GRANT ALL ON public.project_sources TO service_role;

ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own sources" ON public.project_sources
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert own sources" ON public.project_sources
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own sources" ON public.project_sources
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete own sources" ON public.project_sources
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER project_sources_set_updated_at
  BEFORE UPDATE ON public.project_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX project_sources_project_idx ON public.project_sources(project_id);
CREATE INDEX project_sources_user_idx ON public.project_sources(user_id);

-- Storage RLS for source-plans bucket: files keyed by `<user_id>/...`
CREATE POLICY "source-plans owners read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'source-plans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "source-plans owners insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'source-plans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "source-plans owners delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'source-plans' AND auth.uid()::text = (storage.foldername(name))[1]);
