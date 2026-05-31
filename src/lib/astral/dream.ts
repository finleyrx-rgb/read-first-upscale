// Dream-mode state: moodboard references, intent text, spatial qualities, typology.
// Persisted to localStorage. Supabase persistence deferred to D9.

import { create } from "zustand";
import { useAstral } from "./store";
import { TEMPLATES } from "./constants";

export type DreamReference = {
  id: string;
  kind: "photo" | "ai-render" | "sketch" | "note";
  src?: string;
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  caption?: string;
  ts: number;
};

export type DreamState = {
  typologyId: string | null;
  references: DreamReference[];
  intent: string;
  spatialQualities: string[];
};

export type Typology = {
  id: string;
  title: string;
  qualities: [string, string, string];
  notes: string;
  hero: string; // image URL
  /** Which built-in TEMPLATES index to seed when crystallising. */
  templateIndex: number;
};

export const TYPOLOGIES: Typology[] = [
  {
    id: "coastal-bach",
    title: "Coastal Bach",
    qualities: ["lightness", "openness", "weather-tested"],
    notes: "NZ vernacular, sliding doors, simple massing",
    hero: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
    templateIndex: 1,
  },
  {
    id: "bush-cabin",
    title: "Cabin in the Bush",
    qualities: ["enclosure", "warmth", "vertical timber"],
    notes: "Small footprint, steep roof",
    hero: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800",
    templateIndex: 2,
  },
  {
    id: "garage-workshop",
    title: "Garage / Workshop",
    qualities: ["utility", "scale", "function-first"],
    notes: "What we have today",
    hero: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
    templateIndex: 0,
  },
  {
    id: "sleepout",
    title: "Sleepout",
    qualities: ["modesty", "single-room", "garden-adjacent"],
    notes: "Small, simple",
    hero: "https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800",
    templateIndex: 1,
  },
  {
    id: "tiny-home",
    title: "Tiny Home",
    qualities: ["compactness", "lightness on land", "mobility-ready"],
    notes: "Small but lived-in",
    hero: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800",
    templateIndex: 4,
  },
  {
    id: "house-truck",
    title: "House Truck / Caravan",
    qualities: ["mobile", "chassis-bound", "adventure"],
    notes: "Flagged as future-build",
    hero: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800",
    templateIndex: 4,
  },
  {
    id: "passive-home",
    title: "Passive Home",
    qualities: ["envelope-first", "performance", "airtight"],
    notes: "Performance layer is a future enhancement",
    hero: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
    templateIndex: 2,
  },
  {
    id: "vernacular-nz",
    title: "Vernacular NZ",
    qualities: ["familiar", "weathered", "materials of place"],
    notes: "Flexible base",
    hero: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800",
    templateIndex: 1,
  },
];

export const SPATIAL_QUALITIES = [
  "light", "threshold", "enclosure", "openness", "prospect", "refuge",
  "weight", "lightness", "materiality", "scale", "horizon", "procession",
  "warmth", "airiness",
];

const KEY = "astral.dream.v1";

const INITIAL: DreamState = {
  typologyId: null,
  references: [],
  intent: "",
  spatialQualities: [],
};

function load(): DreamState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...INITIAL, ...(JSON.parse(raw) as DreamState) };
  } catch { /* noop */ }
  return INITIAL;
}

function save(s: DreamState) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

type Actions = {
  hydrate: () => void;
  setTypology: (id: string | null) => void;
  setIntent: (t: string) => void;
  toggleQuality: (q: string) => void;
  addReference: (r: Omit<DreamReference, "id" | "ts">) => void;
  updateReference: (id: string, p: Partial<DreamReference>) => void;
  removeReference: (id: string) => void;
  reset: () => void;
};

export const useDream = create<DreamState & Actions>((set, get) => ({
  ...INITIAL,
  hydrate: () => set(load()),
  setTypology: (typologyId) => { set({ typologyId }); save(get()); },
  setIntent: (intent) => { set({ intent }); save(get()); },
  toggleQuality: (q) => {
    const cur = get().spatialQualities;
    const next = cur.includes(q) ? cur.filter((x) => x !== q) : [...cur, q];
    set({ spatialQualities: next });
    save(get());
  },
  addReference: (r) => {
    const ref: DreamReference = { ...r, id: Math.random().toString(36).slice(2, 10), ts: Date.now() };
    set((s) => ({ references: [...s.references, ref] }));
    save(get());
  },
  updateReference: (id, p) => {
    set((s) => ({ references: s.references.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
    save(get());
  },
  removeReference: (id) => {
    set((s) => ({ references: s.references.filter((r) => r.id !== id) }));
    save(get());
  },
  reset: () => { set(INITIAL); save(INITIAL); },
}));

/**
 * Crystallise: read dream state, pick a template based on typology,
 * apply it to the build store, and flip mode to "build".
 */
export function crystallise(): { ok: boolean; message: string } {
  const d = useDream.getState();
  const typo = TYPOLOGIES.find((t) => t.id === d.typologyId) ?? TYPOLOGIES[0];
  const store = useAstral.getState();
  store.loadTemplate(typo.templateIndex);
  store.patch({ mode: "build", step: 0 });
  return {
    ok: true,
    message: `Crystallised from ${typo.title}. Refine from here.`,
  };
}

export function canCrystallise(): boolean {
  const d = useDream.getState();
  return Boolean(d.typologyId) || d.intent.trim().length > 20 || d.references.length >= 3;
}
