// Project Astral — Zustand store. Single source of truth for the configurator.
// Replaces the legacy mutable global `S` in public/astral.html.

import { create } from "zustand";
import type {
  CutKey, FaceKey, LayerKey, UnitKey, ViewKey, WallKey,
} from "./constants";
import { TEMPLATES } from "./constants";
import { DEFAULT_WALL_TYPES, type WallType } from "./wallTypes";

export type Opening = {
  id: number;
  kind: "Garage" | "Door" | "Window";
  wall: WallKey;
  off: number;
  width: number;
  /** Top of opening above FFL (mm). Optional — falls back to defaultHead(kind, studH). */
  head?: number;
  /** Bottom of opening above FFL (mm). Optional — falls back to defaultSill(kind). */
  sill?: number;
};

/** Default head height (top of opening above FFL) for an opening kind. */
export function defaultHead(kind: Opening["kind"], studH: number): number {
  if (kind === "Garage") return Math.min(studH - 200, 2400);
  if (kind === "Door") return 1980;
  return 2000; // Window
}

/** Default sill height (bottom of opening above FFL) for an opening kind. */
export function defaultSill(kind: Opening["kind"]): number {
  return kind === "Window" ? 900 : 0;
}

/** Returns ids of openings that overlap another on the same wall. */
export function overlappingOpeningIds(openings: Opening[]): Set<number> {
  const bad = new Set<number>();
  const walls: Record<WallKey, Opening[]> = { N: [], S: [], E: [], W: [] };
  openings.forEach((o) => walls[o.wall].push(o));
  (Object.values(walls) as Opening[][]).forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const a1 = a.off - a.width / 2, a2 = a.off + a.width / 2;
        const b1 = b.off - b.width / 2, b2 = b.off + b.width / 2;
        if (a2 > b1 && b2 > a1) { bad.add(a.id); bad.add(b.id); }
      }
    }
  });
  return bad;
}

export type Partition = {
  id: number;
  dir: "Across width" | "Along length";
  off: number;
  start: number;
  len: number;
  type: "Partition" | "Structural" | "Wet";
  door: boolean;
  doorW: number;
  doorOff: number;
};

export type AstralState = {
  // project
  type: string;
  wind: string;
  found: string;

  // dimensions (mm)
  L: number;
  W: number;
  studH: number;
  spacing: number;
  eave: number;

  // roof
  roof: string;
  pitch: number;
  cover: string;
  struct: string;
  roofCol: string;

  // finishes
  joinery: string;
  clad: string;
  cladCol: string;
  lining: string;
  floor: string;
  insul: string;

  // view state
  view: ViewKey;
  layer: LayerKey;
  face: FaceKey;
  cut: CutKey;
  /** Cut-line position along the perpendicular axis (0..1). 0.5 = centre. */
  cutPos: number;
  unit: UnitKey;

  // multi-unit / advanced roof
  units: 1 | 2 | 3;
  parapet: boolean;

  /** Wall construction type, per perimeter wall (§7.1 wall-type legend). */
  wallTypes: Record<WallKey, WallType>;

  // model collections
  openings: Opening[];
  parts: Partition[];

  // UI step / selection
  step: number;
  sel: string | null;
  detailFor: string | null;
};

const UNIT_KEY = "astral.unit";
function loadUnit(): UnitKey {
  // Deterministic SSR + initial-render value. Client hydration restores the
  // saved preference via the useAstralUnitHydration() hook below.
  return "m";
}
export function readStoredUnit(): UnitKey {
  if (typeof window === "undefined") return "m";
  try {
    const v = window.localStorage.getItem(UNIT_KEY);
    if (v === "m" || v === "mm") return v;
  } catch { /* noop */ }
  return "m";
}
function saveUnit(u: UnitKey) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(UNIT_KEY, u); } catch { /* noop */ }
}

export const INITIAL_STATE: AstralState = {
  type: "Garage",
  wind: "Extra High",
  found: "Concrete slab",
  L: 10000,
  W: 8000,
  studH: 3000,
  spacing: 600,
  eave: 450,
  roof: "Hip",
  pitch: 20,
  cover: "Colorsteel corrugate",
  struct: "Prefab trusses",
  roofCol: "Ironsand",
  joinery: "Fiji mahogany",
  clad: "Plaster system",
  cladCol: "Cream",
  lining: "Plywood",
  floor: "Sealed / clear",
  insul: "None — open",
  view: "plan",
  layer: "arch",
  face: "front",
  cut: "cross",
  cutPos: 0.5,
  unit: loadUnit(),
  units: 1,
  parapet: false,
  wallTypes: { ...DEFAULT_WALL_TYPES },
  openings: [
    { id: 1, kind: "Garage", wall: "W", off: 4000, width: 5000 },
    { id: 2, kind: "Door", wall: "S", off: 2000, width: 810 },
    { id: 3, kind: "Window", wall: "S", off: 7200, width: 1200 },
  ],
  parts: [],
  step: 0,
  sel: null,
  detailFor: null,
};

/** Auto-trim openings + partitions so they fit inside L × W. */
function clampToDims(s: AstralState): Partial<AstralState> {
  const wallLen = (w: WallKey) => (w === "N" || w === "S" ? s.L : s.W);
  const openings = s.openings.map((o) => {
    const wl = wallLen(o.wall);
    const width = Math.min(o.width, Math.max(400, wl - 200));
    const off = Math.max(width / 2, Math.min(wl - width / 2, o.off));
    return { ...o, width, off };
  });
  const parts = s.parts.map((p) => {
    const runMax = p.dir === "Across width" ? s.W : s.L;
    const posMax = p.dir === "Across width" ? s.L : s.W;
    const off = Math.max(0, Math.min(posMax, p.off));
    const start = Math.max(0, Math.min(runMax - 200, p.start));
    const len = Math.max(200, Math.min(runMax - start, p.len));
    const doorOff = Math.max(0, Math.min(runMax, p.doorOff));
    return { ...p, off, start, len, doorOff };
  });
  return { openings, parts };
}

type Actions = {
  set: <K extends keyof AstralState>(key: K, value: AstralState[K]) => void;
  patch: (patch: Partial<AstralState>) => void;

  addOpening: () => void;
  updateOpening: (id: number, patch: Partial<Opening>) => void;
  removeOpening: (id: number) => void;

  addPartition: () => void;
  updatePartition: (id: number, patch: Partial<Partition>) => void;
  removePartition: (id: number) => void;

  loadTemplate: (idx: number) => void;
  applyType: (type: string) => void;
  setStep: (i: number) => void;
  setSel: (id: string | null) => void;
  setDetailFor: (id: string | null) => void;
};

export type AstralStore = AstralState & Actions;

let nid = 100;

const dimKeys = new Set(["L", "W"]);

/** Read URL share param (?p=...) or localStorage. Browser-only — never call in SSR. */
export function readBootstrap(): Partial<AstralState> | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("p");
    if (token) {
      const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
      const raw = atob(token.replace(/-/g, "+").replace(/_/g, "/") + pad);
      return JSON.parse(decodeURIComponent(escape(raw))) as Partial<AstralState>;
    }
    const ls = window.localStorage.getItem("astral.project.v1");
    if (ls) return JSON.parse(ls) as Partial<AstralState>;
  } catch { /* noop */ }
  return null;
}

export const useAstral = create<AstralStore>((set, get) => ({
  ...INITIAL_STATE,

  set: (key, value) => {
    if (key === "unit") saveUnit(value as UnitKey);
    set({ [key]: value } as Partial<AstralState>);
    if (dimKeys.has(key as string)) set((s) => clampToDims(s) as Partial<AstralState>);
  },
  patch: (p) => {
    if (p.unit) saveUnit(p.unit);
    set(p);
    if ("L" in p || "W" in p) set((s) => clampToDims(s) as Partial<AstralState>);
  },

  addOpening: () => set((s) => ({
    openings: [...s.openings, {
      id: nid++, kind: "Window", wall: "N", off: Math.round(s.L / 2), width: 1200,
      head: defaultHead("Window", s.studH), sill: defaultSill("Window"),
    }],
  })),
  updateOpening: (id, patch) => set((s) => ({
    openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  })),
  removeOpening: (id) => set((s) => ({ openings: s.openings.filter((o) => o.id !== id) })),

  addPartition: () => set((s) => ({
    parts: [...s.parts, {
      id: nid++, dir: "Across width", off: Math.round(s.L / 2),
      start: 0, len: s.W, type: "Partition",
      door: true, doorW: 810, doorOff: Math.round(s.W / 2),
    }],
  })),
  updatePartition: (id, patch) => set((s) => ({
    parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  })),
  removePartition: (id) => set((s) => ({ parts: s.parts.filter((p) => p.id !== id) })),

  loadTemplate: (idx) => {
    const t = TEMPLATES[idx];
    if (!t) return;
    const tp = t.s;
    set({
      type: tp.type, L: tp.L, W: tp.W, studH: tp.studH,
      roof: tp.roof, pitch: tp.pitch, struct: tp.struct,
      clad: tp.clad, cover: tp.cover,
      openings: tp.ops.map((o) => ({
        id: nid++, kind: o[0] as Opening["kind"], wall: o[1] as WallKey, off: o[2] as number, width: o[3] as number,
      })),
      parts: [],
      units: ("units" in tp ? (tp as { units: 1 | 2 | 3 }).units : 1),
      parapet: false,
      wallTypes: { ...DEFAULT_WALL_TYPES },
      sel: null, detailFor: null,
      view: get().view === "detail" ? "plan" : get().view,
    });
  },

  applyType: (type) => {
    const s = get();
    const gl = type === "Garage" || type === "Workshop";
    const hasG = s.openings.some((o) => o.kind === "Garage");
    let openings = s.openings;
    if (gl && !hasG) {
      openings = [
        { id: nid++, kind: "Garage", wall: "W", off: Math.round(s.W / 2), width: Math.min(5000, Math.round(s.W * 0.6)) },
        ...openings,
      ];
    }
    if (!gl) {
      openings = openings.filter((o) => o.kind !== "Garage");
      if (!openings.some((o) => o.kind === "Door")) {
        openings = [...openings, { id: nid++, kind: "Door", wall: "S", off: 1500, width: 810 }];
      }
    }
    set({ type, openings });
  },

  setStep: (i) => set({ step: i }),
  setSel: (id) => set({ sel: id }),
  setDetailFor: (id) => set({ detailFor: id }),
}));

// Bump the local ID counter past anything we just loaded.
{
  const s = useAstral.getState();
  const maxOpen = s.openings.reduce((m, o) => Math.max(m, o.id), 0);
  const maxPart = s.parts.reduce((m, p) => Math.max(m, p.id), 0);
  if (maxOpen + 1 > nid) nid = maxOpen + 1;
  if (maxPart + 1 > nid) nid = maxPart + 1;
}

// Autosave: debounced write of the current project to localStorage. Skips UI fields.
if (typeof window !== "undefined") {
  const UI_KEYS = new Set(["view", "layer", "face", "cut", "cutPos", "step", "sel", "detailFor", "unit"]);
  let t: number | null = null;
  useAstral.subscribe((s) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => {
      try {
        const out: Record<string, unknown> = {};
        Object.entries(s).forEach(([k, v]) => {
          if (typeof v === "function") return;
          if (UI_KEYS.has(k)) return;
          out[k] = v;
        });
        window.localStorage.setItem("astral.project.v1", JSON.stringify(out));
      } catch { /* noop */ }
    }, 400);
  });
}

