// Persistence API for Astral projects (Phase 8 §7.9).
// Owners-only CRUD via the browser Supabase client (RLS-enforced).

import { supabase } from "@/integrations/supabase/client";
import type { AstralState } from "./store";
import { buildModel, type Model } from "./model";
import { buildTakeoff, type Takeoff } from "./takeoff";

export type ProjectMeta = {
  id: string;
  name: string;
  address: string | null;
  start_date: string | null;
  finish_date: string | null;
  notes: string | null;
  share_token: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectSnapshot = {
  state: AstralState;
  meta: { name: string; address?: string; notes?: string };
  derived?: { model: Model; takeoff: Takeoff };
  version: 1;
};

export type ProjectRow = ProjectMeta & { snapshot: ProjectSnapshot };

export type ProjectMetaInput = {
  name: string;
  address?: string | null;
  start_date?: string | null;
  finish_date?: string | null;
  notes?: string | null;
};

function buildSnapshot(state: AstralState, meta: ProjectMetaInput): ProjectSnapshot {
  return {
    state,
    meta: {
      name: meta.name,
      address: meta.address ?? undefined,
      notes: meta.notes ?? undefined,
    },
    derived: { model: buildModel(state), takeoff: buildTakeoff(state) },
    version: 1,
  };
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,address,start_date,finish_date,notes,share_token,is_public,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectMeta[];
}

export async function createProject(state: AstralState, meta: ProjectMetaInput): Promise<ProjectMeta> {
  const { data: u, error: uerr } = await supabase.auth.getUser();
  if (uerr || !u.user) throw new Error("Sign in to save projects");
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: u.user.id,
      name: meta.name,
      address: meta.address ?? null,
      start_date: meta.start_date ?? null,
      finish_date: meta.finish_date ?? null,
      notes: meta.notes ?? null,
      snapshot: buildSnapshot(state, meta) as never,
    })
    .select("id,name,address,start_date,finish_date,notes,share_token,is_public,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as ProjectMeta;
}

export async function updateProject(id: string, state: AstralState, meta: ProjectMetaInput): Promise<ProjectMeta> {
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: meta.name,
      address: meta.address ?? null,
      start_date: meta.start_date ?? null,
      finish_date: meta.finish_date ?? null,
      notes: meta.notes ?? null,
      snapshot: buildSnapshot(state, meta) as never,
    })
    .eq("id", id)
    .select("id,name,address,start_date,finish_date,notes,share_token,is_public,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as ProjectMeta;
}

export async function loadProject(id: string): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as ProjectRow;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function setProjectShared(id: string, isPublic: boolean): Promise<ProjectMeta> {
  const { data, error } = await supabase
    .from("projects")
    .update({ is_public: isPublic })
    .eq("id", id)
    .select("id,name,address,start_date,finish_date,notes,share_token,is_public,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as ProjectMeta;
}

export function shareUrlFor(token: string): string {
  if (typeof window === "undefined") return `/shared/${token}`;
  return `${window.location.origin}/shared/${token}`;
}
