// Source documents (uploaded plan PDFs/images) — storage + table CRUD.

import { supabase } from "@/integrations/supabase/client";
import type { PageAnalysis } from "./types";

export type ProjectSource = {
  id: string;
  project_id: string;
  user_id: string;
  kind: "pdf" | "image";
  storage_path: string;
  original_filename: string;
  page_count: number;
  analysis: PageAnalysis[];
  uploaded_at: string;
};

const BUCKET = "source-plans";

export async function uploadSource(args: {
  projectId: string;
  file: File;
  pageCount: number;
  kind: "pdf" | "image";
}): Promise<ProjectSource> {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) throw new Error("Sign in required");

  const safe = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${args.projectId}/${Date.now()}-${safe}`;
  const up = await supabase.storage.from(BUCKET).upload(path, args.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: args.file.type || undefined,
  });
  if (up.error) throw up.error;

  const ins = await supabase
    .from("project_sources")
    .insert({
      project_id: args.projectId,
      user_id: user.id,
      kind: args.kind,
      storage_path: path,
      original_filename: args.file.name,
      page_count: args.pageCount,
      analysis: [],
    })
    .select()
    .single();
  if (ins.error) throw ins.error;
  return ins.data as unknown as ProjectSource;
}

export async function listSources(projectId: string): Promise<ProjectSource[]> {
  const { data, error } = await supabase
    .from("project_sources")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectSource[];
}

export async function deleteSource(s: ProjectSource): Promise<void> {
  await supabase.storage.from(BUCKET).remove([s.storage_path]).catch(() => {});
  const { error } = await supabase.from("project_sources").delete().eq("id", s.id);
  if (error) throw error;
}

export async function saveAnalysis(id: string, analysis: PageAnalysis[]): Promise<void> {
  const { error } = await supabase
    .from("project_sources")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ analysis: analysis as any })
    .eq("id", id);
  if (error) throw error;
}

export async function signedUrl(path: string, ttl = 600): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}
