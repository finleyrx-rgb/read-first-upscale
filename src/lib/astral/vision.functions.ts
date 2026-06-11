// Phase 10 — Vision server functions.
//
// 1. transcribeSketch — vision LLM walks a hand-sketch photo and returns a
//    proposed list of AgentActions (using the Phase 9 action grammar). The
//    client reviews the diff and applies; the server never mutates state.
//
// 2. renderSiteConcept — takes a site photo + a textual building description,
//    asks the gateway's image model to inpaint the building into the photo,
//    returns a base64 PNG. The client uploads it to storage + records it on
//    the project.

import { createServerFn } from "@tanstack/react-start";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createLovableGateway } from "./agent/gateway.server";
import { ActionSchema, type AgentAction } from "./agent/grammar";
import { ASTRAL_KNOWLEDGE } from "./agent/knowledge";

// ---------- Sketch transcription ----------

const SketchInput = z.object({
  imageDataUrl: z.string().min(64).max(20_000_000),
  state: z.record(z.string(), z.unknown()),
  notes: z.string().max(800).optional(),
});

export type SketchTranscriptionResult = {
  text: string;
  actions: AgentAction[];
  error?: string;
};

function buildSketchTools(collected: AgentAction[]) {
  const variants = ActionSchema.options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};
  for (const variant of variants) {
    const shape = variant.shape as Record<string, z.ZodTypeAny>;
    const verb = (shape.verb as z.ZodLiteral<string>).value as string;
    const { verb: _omit, ...rest } = shape;
    const inputSchema = z.object(rest);
    tools[verb] = tool({
      description: `Propose model mutation '${verb}' inferred from the sketch. mm units.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: inputSchema as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (input: any) => {
        const parsed = ActionSchema.safeParse({ verb, ...(input as object) });
        if (!parsed.success) return { ok: false, error: parsed.error.message };
        collected.push(parsed.data);
        return { ok: true, queued: parsed.data };
      },
    });
  }
  return tools;
}

export const transcribeSketch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SketchInput.parse(input))
  .handler(async ({ data }): Promise<SketchTranscriptionResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { text: "", actions: [], error: "Missing LOVABLE_API_KEY" };

    const gateway = createLovableGateway(key);
    const model = gateway("openai/gpt-5");

    const collected: AgentAction[] = [];
    const tools = buildSketchTools(collected);

    const stateSummary = JSON.stringify(data.state, (_k, v) =>
      typeof v === "number" ? Math.round(v) : v,
    ).slice(0, 4000);

    const systemPrompt = [
      ASTRAL_KNOWLEDGE,
      "",
      "## Task: Sketch → model patches",
      "You are looking at a hand-drawn architectural sketch (plan, elevation,",
      "or napkin doodle) the user just uploaded. Extract design intent and",
      "propose AgentActions that bring the live model closer to the sketch:",
      "",
      "- Read dimensions written on the sketch (assume mm if a bare number is",
      "  >100, else m and convert to mm). If unlabelled, infer plausible",
      "  small-building sizes (3–12 m sides, 2.4–3 m stud).",
      "- Look for footprint, window/door positions, partitions, room labels,",
      "  roof shape/pitch annotations.",
      "- Emit one tool call per change. Be conservative — only propose what",
      "  the sketch clearly shows. Skip unsupported things (e.g. fixtures).",
      "- Do NOT call any tools you are not 100% sure about. The user will",
      "  review every action in a diff before anything is applied.",
      "- Finish with a short prose summary of what you saw and what you",
      "  propose to change.",
      "",
      "## Live model state (for context only — patch toward the sketch)",
      "```json",
      stateSummary,
      "```",
      data.notes ? `\n## User notes\n${data.notes}` : "",
    ].join("\n");

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Here is the sketch. Propose the patches." },
              // AI SDK accepts data URLs directly for image parts.
              { type: "image", image: data.imageDataUrl },
            ],
          },
        ],
        tools,
        stopWhen: stepCountIs(50),
      });
      return { text: result.text || "Done.", actions: collected };
    } catch (e) {
      console.error("transcribeSketch failed", e);
      return { text: "", actions: collected, error: e instanceof Error ? e.message : String(e) };
    }
  });

// ---------- Site photo render ----------

const RenderInput = z.object({
  sitePhotoDataUrl: z.string().min(64).max(20_000_000),
  description: z.string().min(8).max(4000),
});

export type SiteRenderResult = {
  /** base64-encoded PNG (no data: prefix). */
  imageBase64?: string;
  text?: string;
  error?: string;
};

export const renderSiteConcept = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data }): Promise<SiteRenderResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { error: "Missing LOVABLE_API_KEY" };

    const prompt = [
      "You are an architectural visualiser. The attached image is a real",
      "photograph of a build site. Insert a CONCEPT massing of the building",
      "described below into the site, respecting the photograph's perspective,",
      "ground plane, lighting, and surroundings. Keep the result clearly",
      "diagrammatic / indicative — not photorealistic. Preserve the original",
      "site context (sky, vegetation, neighbouring buildings) wherever the",
      "new building does not overlap.",
      "",
      "Building to insert:",
      data.description,
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Lovable-API-Key": key,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.sitePhotoDataUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) return { error: "Rate limit — try again shortly." };
        if (res.status === 402)
          return { error: "AI credits exhausted — add credits in Settings → Workspace → Usage." };
        return { error: `Render failed (${res.status}): ${body.slice(0, 240)}` };
      }
      const json = (await res.json()) as { data?: Array<{ b64_json?: string }>; choices?: unknown };
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) return { error: "No image returned by the model." };
      return { imageBase64: b64 };
    } catch (e) {
      console.error("renderSiteConcept failed", e);
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
