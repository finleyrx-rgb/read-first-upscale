// Client-side helpers for storing concept renders + sketch imports
// against the project (Phase 10).

import { supabase } from "@/integrations/supabase/client";

export type RenderRow = {
  id: string;
  project_id: string;
  user_id: string;
  kind: "site-render" | "sketch-import";
  storage_path: string | null;
  caption: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  /** Resolved public URL (filled in by listRenders). */
  url?: string;
};

const BUCKET = "concept-renders";

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function base64ToBlob(b64: string, mime = "image/png"): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadRender(opts: {
  projectId: string;
  kind: RenderRow["kind"];
  /** base64 (no data: prefix) OR a data URL. */
  base64?: string;
  dataUrl?: string;
  caption?: string;
  meta?: Record<string, unknown>;
}): Promise<RenderRow> {
  const { data: u, error: uerr } = await supabase.auth.getUser();
  if (uerr || !u.user) throw new Error("Sign in to save renders");

  const blob = opts.dataUrl ? dataUrlToBlob(opts.dataUrl) : base64ToBlob(opts.base64 ?? "");
  if (blob.size === 0) throw new Error("Empty image payload");

  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `${u.user.id}/${opts.projectId}/${opts.kind}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("project_renders")
    .insert({
      project_id: opts.projectId,
      user_id: u.user.id,
      kind: opts.kind,
      storage_path: path,
      caption: opts.caption ?? null,
      meta: (opts.meta ?? {}) as never,
    })
    .select("*")
    .single();
  if (error) throw error;

  return { ...(data as RenderRow), url: publicUrl(path) };
}

export async function listRenders(projectId: string): Promise<RenderRow[]> {
  const { data, error } = await supabase
    .from("project_renders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RenderRow[]).map((r) => ({
    ...r,
    url: r.storage_path ? publicUrl(r.storage_path) : undefined,
  }));
}

export async function deleteRender(row: RenderRow): Promise<void> {
  if (row.storage_path) {
    await supabase.storage
      .from(BUCKET)
      .remove([row.storage_path])
      .catch(() => {});
  }
  const { error } = await supabase.from("project_renders").delete().eq("id", row.id);
  if (error) throw error;
}

/** Read a File as a data URL — used by the upload inputs. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}
