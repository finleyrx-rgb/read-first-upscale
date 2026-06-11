// Dream-mode action grammar. Parallel to the Build-mode `ActionSchema`,
// but the verbs ONLY mutate `useDream` — never the build model. This is the
// hard separation that keeps Dream mode exploratory.

import { z } from "zod";
import { useDream, TYPOLOGIES, crystallise as runCrystallise } from "../dream";
import { useAstral } from "../store";

export const DreamActionSchema = z.discriminatedUnion("verb", [
  z.object({
    verb: z.literal("addReference"),
    kind: z.enum(["photo", "ai-render", "sketch", "note"]),
    src: z.string().optional(),
    text: z.string().optional(),
    caption: z.string().optional(),
  }),
  z.object({
    verb: z.literal("setSpatialQualities"),
    qualities: z.array(z.string()).min(0).max(20),
  }),
  z.object({
    verb: z.literal("selectTypology"),
    id: z.string(),
  }),
  z.object({
    verb: z.literal("setIntent"),
    text: z.string().max(2000),
  }),
  z.object({
    verb: z.literal("crystallise"),
  }),
]);

export type DreamAction = z.infer<typeof DreamActionSchema>;

export function applyDreamAction(a: DreamAction): { highlight?: string } {
  const d = useDream.getState();
  switch (a.verb) {
    case "addReference": {
      const w = a.kind === "note" ? 240 : 320;
      const h = a.kind === "note" ? 160 : 220;
      const x = 80 + Math.random() * 320;
      const y = 80 + Math.random() * 200;
      d.addReference({ kind: a.kind, src: a.src, text: a.text, caption: a.caption, x, y, w, h });
      return {};
    }
    case "setSpatialQualities": {
      // Diff against current to reuse toggleQuality (preserves order semantics).
      const cur = new Set(d.spatialQualities);
      const next = new Set(a.qualities);
      for (const q of cur) if (!next.has(q)) d.toggleQuality(q);
      for (const q of next) if (!cur.has(q)) d.toggleQuality(q);
      return {};
    }
    case "selectTypology": {
      if (!TYPOLOGIES.some((t) => t.id === a.id)) return {};
      d.setTypology(a.id);
      return {};
    }
    case "setIntent": {
      d.setIntent(a.text);
      return {};
    }
    case "crystallise": {
      runCrystallise();
      // Flip handled in crystallise(); ensure mode is build.
      useAstral.getState().patch({ mode: "build" });
      return {};
    }
  }
}
