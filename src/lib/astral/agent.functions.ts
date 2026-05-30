// Astral agent — server function. Calls Lovable AI with the action grammar
// as tool definitions; tool execution returns the proposed action (the
// CLIENT is responsible for applying patches, so the agent never mutates
// state directly on the server).

import { createServerFn } from "@tanstack/react-start";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createLovableGateway } from "./agent/gateway.server";
import { ActionSchema, type AgentAction } from "./agent/grammar";
import { ASTRAL_KNOWLEDGE } from "./agent/knowledge";

const TurnInput = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }))
    .max(40)
    .default([]),
  state: z.record(z.string(), z.unknown()),
  selectedId: z.string().nullable().optional(),
});

export type AgentTurnInput = z.infer<typeof TurnInput>;

export type AgentTurnResult = {
  text: string;
  actions: AgentAction[];
  error?: string;
};

// Build one AI SDK tool per discriminated-union variant of ActionSchema.
function buildTools(collected: AgentAction[]) {
  // Extract per-verb schemas
  const variants = ActionSchema.options;
  const tools: Record<string, ReturnType<typeof tool>> = {};
  for (const variant of variants) {
    // each variant is a ZodObject with a literal `verb`
    const shape = variant.shape as Record<string, z.ZodTypeAny>;
    const verb = (shape.verb as z.ZodLiteral<string>).value;
    // Build input schema without the `verb` discriminator (LLM doesn't need it)
    const { verb: _omit, ...rest } = shape;
    const inputSchema = z.object(rest);
    tools[verb] = tool({
      description: `Mutate the model — verb '${verb}'. All distances in mm.`,
      inputSchema,
      execute: async (input) => {
        const parsed = ActionSchema.safeParse({ verb, ...(input as object) });
        if (!parsed.success) {
          return { ok: false, error: parsed.error.message };
        }
        collected.push(parsed.data);
        return { ok: true, queued: parsed.data };
      },
    });
  }
  return tools;
}

export const astralAgentTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TurnInput.parse(input))
  .handler(async ({ data }): Promise<AgentTurnResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { text: "", actions: [], error: "Missing LOVABLE_API_KEY" };

    const gateway = createLovableGateway(key);
    const model = gateway("openai/gpt-5-mini");

    const collected: AgentAction[] = [];
    const tools = buildTools(collected);

    const stateSummary = JSON.stringify(data.state, (_k, v) =>
      typeof v === "number" ? Math.round(v) : v,
    ).slice(0, 6000);

    const systemPrompt = [
      ASTRAL_KNOWLEDGE,
      "",
      "## Live model state (read-only snapshot for this turn)",
      "```json",
      stateSummary,
      "```",
      data.selectedId
        ? `\n## Currently selected element: \`${data.selectedId}\``
        : "",
    ].join("\n");

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [
          ...data.history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: data.message },
        ],
        tools,
        stopWhen: stepCountIs(50),
      });
      return { text: result.text || "Done.", actions: collected };
    } catch (e) {
      console.error("astralAgentTurn failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      return { text: "", actions: collected, error: msg };
    }
  });
