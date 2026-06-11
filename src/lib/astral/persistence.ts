// Persistence — autosave to localStorage + URL share encoding.
// Strips UI-only fields (view/layer/face/cut/step/sel/detailFor/unit) so a
// loaded project doesn't yank the viewer out of whatever sheet they're on.

import type { AstralState } from "./store";

export const PROJECT_KEY = "astral.project.v1";
export const PRESETS_KEY = "astral.presets.v1";

const UI_KEYS: (keyof AstralState)[] = [
  "view",
  "layer",
  "face",
  "cut",
  "step",
  "sel",
  "detailFor",
  "unit",
];

export type ProjectSnapshot = Omit<
  AstralState,
  "view" | "layer" | "face" | "cut" | "step" | "sel" | "detailFor" | "unit"
>;

export function snapshot(s: AstralState): ProjectSnapshot {
  const out = { ...s } as Partial<AstralState>;
  UI_KEYS.forEach((k) => delete out[k]);
  return out as ProjectSnapshot;
}

export function saveToStorage(s: AstralState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECT_KEY, JSON.stringify(snapshot(s)));
  } catch {
    /* noop */
  }
}

export function loadFromStorage(): Partial<AstralState> | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PROJECT_KEY);
    return v ? (JSON.parse(v) as Partial<AstralState>) : null;
  } catch {
    return null;
  }
}

// base64url for URL safety
function toB64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function fromB64Url(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

export function encodeShare(s: AstralState): string {
  return toB64Url(JSON.stringify(snapshot(s)));
}

export function decodeShare(token: string): Partial<AstralState> | null {
  try {
    return JSON.parse(fromB64Url(token)) as Partial<AstralState>;
  } catch {
    return null;
  }
}

export function shareUrl(s: AstralState): string {
  if (typeof window === "undefined") return "";
  const u = new URL(window.location.href);
  u.searchParams.set("p", encodeShare(s));
  return u.toString();
}

export function readShareFromUrl(): Partial<AstralState> | null {
  if (typeof window === "undefined") return null;
  const u = new URL(window.location.href);
  const t = u.searchParams.get("p");
  return t ? decodeShare(t) : null;
}

// ── Named presets ─────────────────────────────────────────────────────────
export type NamedPreset = { name: string; saved: number; data: ProjectSnapshot };

export function listPresets(): NamedPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(PRESETS_KEY);
    return v ? (JSON.parse(v) as NamedPreset[]) : [];
  } catch {
    return [];
  }
}

export function savePreset(name: string, s: AstralState): NamedPreset[] {
  const list = listPresets().filter((p) => p.name !== name);
  list.push({ name, saved: Date.now(), data: snapshot(s) });
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  return list;
}

export function deletePreset(name: string): NamedPreset[] {
  const list = listPresets().filter((p) => p.name !== name);
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  return list;
}
