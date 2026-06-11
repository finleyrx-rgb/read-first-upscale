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
  /** Tiny SVG glyph (architectural silhouette) drawn into the card. */
  glyph: string;
  /** Which built-in TEMPLATES index to seed when crystallising. */
  templateIndex: number;
};

// Glyphs: minimal architectural silhouettes drawn at 64×40 viewBox.
const G = {
  bach: "M2 32 L32 12 L62 32 L62 36 L2 36 Z M10 36 L10 22 M54 36 L54 22 M22 36 L22 28 L42 28 L42 36",
  cabin: "M4 36 L32 8 L60 36 Z M26 36 L26 24 L38 24 L38 36",
  garage: "M6 36 L6 14 L58 14 L58 36 Z M12 36 L12 20 L52 20 L52 36",
  sleepout: "M6 36 L6 18 L58 18 L58 36 Z M6 18 L32 8 L58 18 M22 36 L22 26 L34 26 L34 36",
  tiny: "M14 36 L14 16 L50 16 L50 36 Z M14 16 L32 6 L50 16 M28 36 L28 26 L36 26 L36 36",
  truck:
    "M4 32 L4 18 L40 18 L46 14 L58 14 L58 32 Z M14 32 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M40 32 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0",
  passive:
    "M6 36 L6 12 L58 12 L58 36 Z M6 12 L32 4 L58 12 M20 36 L20 22 L30 22 L30 36 M38 22 L48 22 L48 36",
  vernacular: "M6 36 L6 18 L32 6 L58 18 L58 36 Z M22 36 L22 24 L32 24 L32 36 M40 28 L48 28 L48 36",
};

export const TYPOLOGIES: Typology[] = [
  {
    id: "coastal-bach",
    title: "Coastal Bach",
    qualities: ["lightness", "openness", "weather-tested"],
    notes: "NZ vernacular, sliding doors, simple massing",
    glyph: G.bach,
    templateIndex: 1,
  },
  {
    id: "bush-cabin",
    title: "Cabin in the Bush",
    qualities: ["enclosure", "warmth", "vertical timber"],
    notes: "Small footprint, steep roof",
    glyph: G.cabin,
    templateIndex: 2,
  },
  {
    id: "garage-workshop",
    title: "Garage / Workshop",
    qualities: ["utility", "scale", "function-first"],
    notes: "What we have today",
    glyph: G.garage,
    templateIndex: 0,
  },
  {
    id: "sleepout",
    title: "Sleepout",
    qualities: ["modesty", "single-room", "garden-adjacent"],
    notes: "Small, simple",
    glyph: G.sleepout,
    templateIndex: 1,
  },
  {
    id: "tiny-home",
    title: "Tiny Home",
    qualities: ["compactness", "lightness on land", "mobility-ready"],
    notes: "Small but lived-in",
    glyph: G.tiny,
    templateIndex: 4,
  },
  {
    id: "house-truck",
    title: "House Truck / Caravan",
    qualities: ["mobile", "chassis-bound", "adventure"],
    notes: "Flagged as future-build",
    glyph: G.truck,
    templateIndex: 4,
  },
  {
    id: "passive-home",
    title: "Passive Home",
    qualities: ["envelope-first", "performance", "airtight"],
    notes: "Performance layer is a future enhancement",
    glyph: G.passive,
    templateIndex: 2,
  },
  {
    id: "vernacular-nz",
    title: "Vernacular NZ",
    qualities: ["familiar", "weathered", "materials of place"],
    notes: "Flexible base",
    glyph: G.vernacular,
    templateIndex: 1,
  },
];

export const SPATIAL_QUALITIES = [
  "light",
  "threshold",
  "enclosure",
  "openness",
  "prospect",
  "refuge",
  "weight",
  "lightness",
  "materiality",
  "scale",
  "horizon",
  "procession",
  "warmth",
  "airiness",
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
  } catch {
    /* noop */
  }
  return INITIAL;
}

function save(s: DreamState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
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
  setTypology: (typologyId) => {
    set({ typologyId });
    save(get());
  },
  setIntent: (intent) => {
    set({ intent });
    save(get());
  },
  toggleQuality: (q) => {
    const cur = get().spatialQualities;
    const next = cur.includes(q) ? cur.filter((x) => x !== q) : [...cur, q];
    set({ spatialQualities: next });
    save(get());
  },
  addReference: (r) => {
    const ref: DreamReference = {
      ...r,
      id: Math.random().toString(36).slice(2, 10),
      ts: Date.now(),
    };
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
  reset: () => {
    set(INITIAL);
    save(INITIAL);
  },
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
