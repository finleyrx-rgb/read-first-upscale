// Strict action grammar for the Astral agent. These are the ONLY mutation
// verbs the LLM is allowed to emit. Each action is a plain serializable
// patch that the client applies through the existing Zustand store.
//
// Pure module — safe to import from both server (tool schemas) and client
// (patch executor + undo timeline).

import { z } from "zod";
import type { AstralState, Opening, Partition } from "../store";

// ---------- Schemas ----------

const WallEnum = z.enum(["N", "S", "E", "W"]);
const OpeningKind = z.enum(["Garage", "Door", "Window"]);
const ViewEnum = z.enum(["plan", "elevation", "section", "detail"]);
const LayerEnum = z.enum(["arch", "framing", "foundation", "services"]);

export const ActionSchema = z.discriminatedUnion("verb", [
  z.object({
    verb: z.literal("setFootprint"),
    L: z.number().int().min(2000).max(20000).optional(),
    W: z.number().int().min(2000).max(12000).optional(),
    studH: z.number().int().min(2400).max(3600).optional(),
    spacing: z.union([z.literal(400), z.literal(600)]).optional(),
  }),
  z.object({
    verb: z.literal("setRoof"),
    roof: z.enum(["Gable", "Hip", "Mono", "Flat", "Gambrel", "Dutch Gable"]).optional(),
    pitch: z.number().min(0).max(60).optional(),
    cover: z.string().optional(),
    struct: z.enum(["Prefab trusses", "Cut roof"]).optional(),
    parapet: z.boolean().optional(),
  }),
  z.object({
    verb: z.literal("setFinishes"),
    clad: z.string().optional(),
    cladCol: z.string().optional(),
    roofCol: z.string().optional(),
    lining: z.string().optional(),
    floor: z.string().optional(),
    insul: z.string().optional(),
    joinery: z.string().optional(),
  }),
  z.object({
    verb: z.literal("setSite"),
    wind: z.string().optional(),
    found: z.enum(["Concrete slab", "Timber piles"]).optional(),
    type: z.string().optional(),
    units: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  }),
  z.object({
    verb: z.literal("addOpening"),
    kind: OpeningKind,
    wall: WallEnum,
    off: z.number().int().min(0).max(20000),
    width: z.number().int().min(400).max(7000),
    head: z.number().int().optional(),
    sill: z.number().int().optional(),
  }),
  z.object({
    verb: z.literal("updateOpening"),
    id: z.number().int(),
    kind: OpeningKind.optional(),
    wall: WallEnum.optional(),
    off: z.number().int().optional(),
    width: z.number().int().optional(),
    head: z.number().int().optional(),
    sill: z.number().int().optional(),
  }),
  z.object({
    verb: z.literal("removeOpening"),
    id: z.number().int(),
  }),
  z.object({
    verb: z.literal("addPartition"),
    dir: z.enum(["Across width", "Along length"]),
    off: z.number().int(),
    start: z.number().int(),
    len: z.number().int().min(200),
    type: z.enum(["Partition", "Structural", "Wet"]),
    door: z.boolean().default(true),
    doorW: z.number().int().default(810),
    doorOff: z.number().int().default(0),
  }),
  z.object({
    verb: z.literal("removePartition"),
    id: z.number().int(),
  }),
  z.object({
    verb: z.literal("applyTemplate"),
    index: z.number().int().min(0).max(7),
  }),
  z.object({
    verb: z.literal("setView"),
    view: ViewEnum.optional(),
    layer: LayerEnum.optional(),
  }),
  z.object({
    verb: z.literal("selectElement"),
    id: z.string().nullable(),
  }),
]);

export type AgentAction = z.infer<typeof ActionSchema>;

// ---------- Patch executor (client-side) ----------

export type StoreLike = {
  getState: () => AstralState & Record<string, unknown>;
  patch: (p: Partial<AstralState>) => void;
  set: <K extends keyof AstralState>(key: K, value: AstralState[K]) => void;
  addOpening: () => void;
  updateOpening: (id: number, p: Partial<Opening>) => void;
  removeOpening: (id: number) => void;
  addPartition: () => void;
  updatePartition: (id: number, p: Partial<Partition>) => void;
  removePartition: (id: number) => void;
  loadTemplate: (i: number) => void;
  setSel: (id: string | null) => void;
};

export type ActionResult = {
  ok: boolean;
  message: string;
  /** id of element to highlight after applying. */
  highlight?: string | null;
};

/**
 * Apply a validated AgentAction to the store. Returns a human-readable
 * outcome and the id of the changed element so the canvas can highlight it.
 */
export function applyAction(store: StoreLike, action: AgentAction): ActionResult {
  switch (action.verb) {
    case "setFootprint": {
      const p: Partial<AstralState> = {};
      if (action.L !== undefined) p.L = action.L;
      if (action.W !== undefined) p.W = action.W;
      if (action.studH !== undefined) p.studH = action.studH;
      if (action.spacing !== undefined) p.spacing = action.spacing;
      store.patch(p);
      return { ok: true, message: `Footprint updated (${Object.keys(p).join(", ")})`, highlight: "building" };
    }
    case "setRoof": {
      const p: Partial<AstralState> = {};
      (["roof", "pitch", "cover", "struct", "parapet"] as const).forEach((k) => {
        const v = (action as Record<string, unknown>)[k];
        if (v !== undefined) (p as Record<string, unknown>)[k] = v;
      });
      store.patch(p);
      return { ok: true, message: "Roof updated", highlight: "roof" };
    }
    case "setFinishes": {
      const p: Partial<AstralState> = {};
      (["clad", "cladCol", "roofCol", "lining", "floor", "insul", "joinery"] as const).forEach((k) => {
        const v = (action as Record<string, unknown>)[k];
        if (v !== undefined) (p as Record<string, unknown>)[k] = v;
      });
      store.patch(p);
      return { ok: true, message: "Finishes updated", highlight: null };
    }
    case "setSite": {
      const p: Partial<AstralState> = {};
      (["wind", "found", "type", "units"] as const).forEach((k) => {
        const v = (action as Record<string, unknown>)[k];
        if (v !== undefined) (p as Record<string, unknown>)[k] = v;
      });
      store.patch(p);
      return { ok: true, message: "Site settings updated", highlight: null };
    }
    case "addOpening": {
      store.addOpening();
      // grab the just-added opening's id (highest), then patch it to match action
      const all = store.getState().openings;
      const fresh = all[all.length - 1];
      const patch: Partial<Opening> = {
        kind: action.kind, wall: action.wall, off: action.off, width: action.width,
      };
      if (action.head !== undefined) patch.head = action.head;
      if (action.sill !== undefined) patch.sill = action.sill;
      store.updateOpening(fresh.id, patch);
      return { ok: true, message: `Added ${action.kind} on ${action.wall} wall`, highlight: `opening-${fresh.id}` };
    }
    case "updateOpening": {
      const patch: Partial<Opening> = {};
      (["kind", "wall", "off", "width", "head", "sill"] as const).forEach((k) => {
        const v = (action as Record<string, unknown>)[k];
        if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
      });
      store.updateOpening(action.id, patch);
      return { ok: true, message: `Updated opening #${action.id}`, highlight: `opening-${action.id}` };
    }
    case "removeOpening": {
      store.removeOpening(action.id);
      return { ok: true, message: `Removed opening #${action.id}`, highlight: null };
    }
    case "addPartition": {
      store.addPartition();
      const all = store.getState().parts;
      const fresh = all[all.length - 1];
      store.updatePartition(fresh.id, {
        dir: action.dir, off: action.off, start: action.start, len: action.len,
        type: action.type, door: action.door, doorW: action.doorW, doorOff: action.doorOff || Math.round(action.len / 2),
      });
      return { ok: true, message: `Added ${action.type.toLowerCase()} partition`, highlight: `part-${fresh.id}` };
    }
    case "removePartition": {
      store.removePartition(action.id);
      return { ok: true, message: `Removed partition #${action.id}`, highlight: null };
    }
    case "applyTemplate": {
      store.loadTemplate(action.index);
      return { ok: true, message: `Loaded template #${action.index}`, highlight: "building" };
    }
    case "setView": {
      const p: Partial<AstralState> = {};
      if (action.view) p.view = action.view;
      if (action.layer) p.layer = action.layer;
      store.patch(p);
      return { ok: true, message: `View → ${action.view ?? store.getState().view} / ${action.layer ?? store.getState().layer}`, highlight: null };
    }
    case "selectElement": {
      store.setSel(action.id);
      return { ok: true, message: action.id ? `Selected ${action.id}` : "Deselected", highlight: action.id };
    }
  }
}
