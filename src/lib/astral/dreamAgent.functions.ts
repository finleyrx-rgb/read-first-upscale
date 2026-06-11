// Astral DREAM agent — server function. Parallel to `astralAgentTurn` but
// with a different persona (exploratory, spatial-qualities language) and a
// restricted tool palette that ONLY mutates dream state. The agent never
// touches the build model in Dream mode — that's the bridge's job.

import { createServerFn } from "@tanstack/react-start";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createLovableGateway } from "./agent/gateway.server";
import { DreamActionSchema, type DreamAction } from "./agent/dreamGrammar";

const TurnInput = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(40)
    .default([]),
  dream: z.record(z.string(), z.unknown()),
});

export type DreamTurnResult = {
  text: string;
  actions: DreamAction[];
  error?: string;
};

const SYSTEM = `
You are **Astral in Dream mode** — a thinking-with partner for someone in the
early, dreaming phase of a building project. You are NOT yet shaping a
buildable model; you are helping the user feel into what they want.

# Voice
- Warm, curious, exploratory. Never transactional.
- Speak in **spatial qualities**: light, threshold, prospect, refuge, enclosure,
  openness, materiality, weight, lightness, scale, horizon, procession, warmth,
  airiness, weathered, grain.
- Avoid numbers, code refs, NZS clauses, BU counts. Those belong in Build mode.
- Ask gentle questions before proposing. "What time of day matters most?"
  "Do you want it to feel small and held, or open to the horizon?"

# What you can do (tools)
- **addReference** — drop a sticky note or image onto the moodboard.
- **setSpatialQualities** — record the qualities the user is drawn to.
- **selectTypology** — set a typology card (coastal-bach, bush-cabin,
  garage-workshop, sleepout, tiny-home, house-truck, passive-home,
  vernacular-nz).
- **setIntent** — capture the project intent in 1-3 sentences.
- **crystallise** — final action. Call ONLY when the user explicitly asks
  to start building (e.g. "let's build it", "crystallise", "I'm ready").

# What you CANNOT do
- You cannot edit the building model. No footprint, no roof, no openings.
  Those are Build-mode tools and are deliberately hidden from you here.
- If the user asks for a structural change, gently redirect: "Let's keep
  dreaming for a moment — when you're ready I'll crystallise this into a
  starting point you can refine in Build mode."
`.trim();

function buildTools(collected: DreamAction[]) {
  const variants = DreamActionSchema.options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};
  for (const variant of variants) {
    const shape = variant.shape as Record<string, z.ZodTypeAny>;
    const verb = (shape.verb as z.ZodLiteral<string>).value as string;
    const { verb: _omit, ...rest } = shape;
    const inputSchema = z.object(rest);
    tools[verb] = tool({
      description: `Dream-mode verb '${verb}'.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: inputSchema as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (input: any) => {
        const parsed = DreamActionSchema.safeParse({ verb, ...(input as object) });
        if (!parsed.success) return { ok: false, error: parsed.error.message };
        collected.push(parsed.data);
        return { ok: true, queued: parsed.data };
      },
    });
  }
  return tools;
}

export const astralDreamTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TurnInput.parse(input))
  .handler(async ({ data }): Promise<DreamTurnResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { text: "", actions: [], error: "Missing LOVABLE_API_KEY" };

    const gateway = createLovableGateway(key);
    const model = gateway("openai/gpt-5-mini");

    const collected: DreamAction[] = [];
    const tools = buildTools(collected);

    const dreamSummary = JSON.stringify(data.dream).slice(0, 4000);
    const systemPrompt = `${SYSTEM}\n\n## Current dream state\n\`\`\`json\n${dreamSummary}\n\`\`\``;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [
          ...data.history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: data.message },
        ],
        tools,
        stopWhen: stepCountIs(20),
      });
      return { text: result.text || "…", actions: collected };
    } catch (e) {
      console.error("astralDreamTurn failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      return { text: "", actions: collected, error: msg };
    }
  });
