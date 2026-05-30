
-- Storage bucket for concept renders (Phase 10)
INSERT INTO storage.buckets (id, name, public)
VALUES ('concept-renders', 'concept-renders', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (renders are public; URLs are unguessable per-project paths)
CREATE POLICY "Concept renders are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'concept-renders');

-- Owners can upload into their own folder: {user_id}/{project_id}/...
CREATE POLICY "Users can upload own concept renders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'concept-renders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own concept renders"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'concept-renders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own concept renders"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'concept-renders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Per-project table tracking renders (so they appear with the project,
-- not just as orphaned files in storage).
CREATE TABLE public.project_renders (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('site-render','sketch-import')),
  storage_path TEXT,
  caption     TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_renders TO authenticated;
GRANT ALL ON public.project_renders TO service_role;

ALTER TABLE public.project_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own renders"
ON public.project_renders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners insert own renders"
ON public.project_renders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update own renders"
ON public.project_renders FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners delete own renders"
ON public.project_renders FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX project_renders_project_idx ON public.project_renders(project_id, created_at DESC);
