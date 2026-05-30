// Project Astral — Zustand store. Single source of truth for the configurator.
// Replaces the legacy mutable global `S` in public/astral.html.

import { create } from "zustand";
import type {
  CutKey, FaceKey, LayerKey, UnitKey, ViewKey, WallKey,
} from "./constants";
import { TEMPLATES } from "./constants";

export type Opening = {
  id: number;
  kind: "Garage" | "Door" | "Window";
  wall: WallKey;
  off: number;
  width: number;
};

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
  unit: UnitKey;

  // model collections
  openings: Opening[];
  parts: Partition[];

  // UI step / selection
  step: number;
  sel: string | null;
  detailFor: string | null;
};

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
  unit: "m",
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

export const useAstral = create<AstralStore>((set, get) => ({
  ...INITIAL_STATE,

  set: (key, value) => set({ [key]: value } as Partial<AstralState>),
  patch: (p) => set(p),

  addOpening: () => set((s) => ({
    openings: [...s.openings, { id: nid++, kind: "Window", wall: "N", off: Math.round(s.L / 2), width: 1200 }],
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
