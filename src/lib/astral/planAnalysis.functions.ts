// Phase C2 — Plan-page vision analysis.
// Takes a single rendered plan page (image data URL) and asks the vision LLM
// to classify it and propose model-mutating AgentActions via tool calls.

import { createServerFn } from "@tanstack/react-start";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createLovableGateway } from "./agent/gateway.server";
import { ActionSchema, type AgentAction } from "./agent/grammar";
import { ASTRAL_KNOWLEDGE } from "./agent/knowledge";
import type { PageAnalysis, PageKind } from "./sources/types";

const Input = z.object({
  imageDataUrl: z.string().min(64).max(20_000_000),
  pageIndex: z.number().int().min(1),
  filename: z.string().max(200).optional(),
  state: z.record(z.string(), z.unknown()).optional(),
});

const ClassifySchema = z.object({
  kind: z.enum(["floor-plan", "elevation", "section", "detail", "schedule", "cover", "other"]),
  scale: z.string().optional(),
  faceCompass: z.enum(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]).optional(),
  footprint: z.object({ L: z.number(), W: z.number() }).optional(),
  studH: z.number().optional(),
  roofForm: z.string().optional(),
  roofPitch: z.number().optional(),
  notes: z.array(z.string()).max(8).optional(),
  confidence: z.number().min(0).max(1),
});

function buildTools(collected: AgentAction[], classification: { value?: z.infer<typeof ClassifySchema> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  tools.recordClassification = tool({
    description:
      "Record this page's kind, scale, optional compass face, and overall confidence (0..1). Call EXACTLY once before emitting any patches.",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSchema: ClassifySchema as any,
    execute: async (input: z.infer<typeof ClassifySchema>) => {
      classification.value = input;
      return { ok: true };
    },
  });

  for (const variant of ActionSchema.options) {
    const shape = variant.shape as Record<string, z.ZodTypeAny>;
    const verb = (shape.verb as z.ZodLiteral<string>).value as string;
    if (verb === "setView" || verb === "selectElement" || verb === "applyTemplate") continue;
    const { verb: _omit, ...rest } = shape;
    const inputSchema = z.object(rest);
    tools[verb] = tool({
      description: `Propose model mutation '${verb}' inferred from this plan page. mm units.`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: inputSchema as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (input: any) => {
        const parsed = ActionSchema.safeParse({ verb, ...(input as object) });
        if (!parsed.success) return { ok: false, error: parsed.error.message };
        collected.push(parsed.data);
        return { ok: true };
      },
    });
  }
  return tools;
}

export const analyzePlanPage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<PageAnalysis> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return {
        pageIndex: data.pageIndex,
        kind: "other" as PageKind,
        confidence: 0,
        proposedActions: [],
        error: "Missing LOVABLE_API_KEY",
      };
    }

    const gateway = createLovableGateway(key);
    const model = gateway("google/gemini-3-flash-preview");

    const collected: AgentAction[] = [];
    const classification: { value?: z.infer<typeof ClassifySchema> } = {};
    const tools = buildTools(collected, classification);

    const systemPrompt = [
      ASTRAL_KNOWLEDGE,
      "",
      "## Task: NZ architectural plan page → model patches",
      "You are looking at ONE page from an uploaded set of building plans",
      "(NZ conventions). Identify what the page is, then propose AgentActions",
      "that bring Astral's live model closer to what the page shows.",
      "",
      "STEP 1 — Call `recordClassification` ONCE with:",
      "  • kind: floor-plan | elevation | section | detail | schedule | cover | other",
      "  • scale (if visible, e.g. '1:100')",
      "  • faceCompass (for elevations: N/S/E/W)",
      "  • footprint (floor plans only, in mm)",
      "  • studH, roofForm, roofPitch (sections/elevations)",
      "  • notes: up to 8 short observations",
      "  • confidence: 0..1 — be honest. Hand sketches or low-res get <0.6.",
      "",
      "STEP 2 — Emit ONE tool call per model mutation you are confident about:",
      "  • Floor plans → setFootprint, addOpening (per door/window/garage),",
      "    addPartition (per internal wall), setStoreys",
      "  • Elevations → setRoof, setFinishes (cladding), setFootprint (studH)",
      "  • Sections → setStoreys (floorDepth), setSite (found), setRoof (struct)",
      "  • Details/schedules → usually no patches; just classify + notes.",
      "",
      "Rules:",
      "  • mm units throughout. Convert m → mm.",
      "  • Skip anything you cannot read clearly — better to propose nothing",
      "    than to invent. The user reviews every action before apply.",
      "  • Do NOT call setView / selectElement / applyTemplate.",
      "  • Finish with a 1–3 sentence prose summary of what the page shows.",
      data.filename ? `\nSource filename: ${data.filename} (page ${data.pageIndex})` : "",
    ].join("\n");

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse plan page ${data.pageIndex}. Classify first, then propose patches.`,
              },
              { type: "image", image: data.imageDataUrl },
            ],
          },
        ],
        tools,
        stopWhen: stepCountIs(40),
      });

      const c = classification.value;
      return {
        pageIndex: data.pageIndex,
        kind: (c?.kind ?? "other") as PageKind,
        scale: c?.scale,
        faceCompass: c?.faceCompass,
        footprint: c?.footprint,
        studH: c?.studH,
        roof: c?.roofForm || c?.roofPitch ? { form: c?.roofForm, pitch: c?.roofPitch } : undefined,
        notes: c?.notes,
        confidence: c?.confidence ?? 0.4,
        proposedActions: collected,
        summary: result.text || undefined,
      };
    } catch (e) {
      console.error("analyzePlanPage failed", e);
      return {
        pageIndex: data.pageIndex,
        kind: "other",
        confidence: 0,
        proposedActions: collected,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
