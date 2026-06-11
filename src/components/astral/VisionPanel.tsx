// Phase 10 — Sketch import + Site-photo render panel.
//
// Two flows, both *never silent*:
// - Sketch transcription: upload → vision LLM returns proposed AgentActions →
//   user reviews each action in a diff list → apply selected.
// - Site render: upload photo → server inpaints the building → preview shows
//   the "Concept render — indicative, not photorealistic." badge → save to project.

import { useEffect, useState } from "react";
import { useAstral, type AstralState } from "@/lib/astral/store";
import { useAuth } from "@/hooks/use-auth";
import {
  transcribeSketch,
  renderSiteConcept,
  type SketchTranscriptionResult,
  type SiteRenderResult,
} from "@/lib/astral/vision.functions";
import { applyAction, type AgentAction } from "@/lib/astral/agent/grammar";
import { describeBuilding } from "@/lib/astral/vision/sceneDescription";
import {
  listRenders,
  uploadRender,
  deleteRender,
  readFileAsDataUrl,
  type RenderRow,
} from "@/lib/astral/vision/renders";

const BTN: React.CSSProperties = {
  padding: "6px 10px",
  background: "#fff",
  border: "1px solid var(--astral-line, #ccc)",
  borderRadius: 4,
  fontFamily: "var(--astral-mono)",
  fontSize: 11,
  cursor: "pointer",
};
const PILL: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: 3,
  fontFamily: "var(--astral-mono)",
  fontSize: 10,
  background: "#222",
  color: "#fff",
};

function actionLabel(a: AgentAction): string {
  const parts: string[] = [a.verb];
  for (const [k, v] of Object.entries(a)) {
    if (k === "verb") continue;
    parts.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(" ");
}

function stateSnapshot(s: AstralState) {
  return {
    type: s.type,
    L: s.L,
    W: s.W,
    studH: s.studH,
    spacing: s.spacing,
    roof: s.roof,
    pitch: s.pitch,
    openings: s.openings,
    parts: s.parts,
  };
}

export function VisionPanel({ projectId }: { projectId: string | null }) {
  const { user } = useAuth();
  const state = useAstral();
  const [tab, setTab] = useState<"sketch" | "render">("sketch");

  // --- sketch flow ---
  const [sketchUrl, setSketchUrl] = useState<string | null>(null);
  const [sketchNotes, setSketchNotes] = useState("");
  const [sketchBusy, setSketchBusy] = useState(false);
  const [sketchResult, setSketchResult] = useState<SketchTranscriptionResult | null>(null);
  const [pickedActions, setPickedActions] = useState<Set<number>>(new Set());

  async function onSketchFile(f: File | null) {
    if (!f) return;
    const url = await readFileAsDataUrl(f);
    setSketchUrl(url);
    setSketchResult(null);
    setPickedActions(new Set());
  }

  async function runSketch() {
    if (!sketchUrl) return;
    setSketchBusy(true);
    try {
      const r = await transcribeSketch({
        data: {
          imageDataUrl: sketchUrl,
          state: stateSnapshot(state) as Record<string, unknown>,
          notes: sketchNotes || undefined,
        },
      });
      setSketchResult(r);
      // Pre-tick all proposed actions for review.
      setPickedActions(new Set(r.actions.map((_, i) => i)));
    } catch (e) {
      setSketchResult({ text: "", actions: [], error: (e as Error).message });
    } finally {
      setSketchBusy(false);
    }
  }

  function applyPicked() {
    if (!sketchResult) return;
    const store = useAstral.getState();
    let applied = 0;
    sketchResult.actions.forEach((a, i) => {
      if (!pickedActions.has(i)) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applyAction(store as any, a);
        applied++;
      } catch (e) {
        console.error("apply failed", a, e);
      }
    });
    setSketchResult({
      ...sketchResult,
      text: sketchResult.text + `\n\n✓ Applied ${applied}/${sketchResult.actions.length} actions.`,
    });
    setPickedActions(new Set());
  }

  // --- render flow ---
  const [sitePhotoUrl, setSitePhotoUrl] = useState<string | null>(null);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderOut, setRenderOut] = useState<SiteRenderResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<RenderRow[]>([]);
  const description = describeBuilding(state);

  useEffect(() => {
    if (!projectId || !user) {
      setSaved([]);
      return;
    }
    listRenders(projectId)
      .then(setSaved)
      .catch(() => {});
  }, [projectId, user]);

  async function onSiteFile(f: File | null) {
    if (!f) return;
    const url = await readFileAsDataUrl(f);
    setSitePhotoUrl(url);
    setRenderOut(null);
  }

  async function runRender() {
    if (!sitePhotoUrl) return;
    setRenderBusy(true);
    try {
      const r = await renderSiteConcept({
        data: { sitePhotoDataUrl: sitePhotoUrl, description },
      });
      setRenderOut(r);
    } catch (e) {
      setRenderOut({ error: (e as Error).message });
    } finally {
      setRenderBusy(false);
    }
  }

  async function saveRender(
    kind: RenderRow["kind"],
    base64OrDataUrl: { base64?: string; dataUrl?: string },
    caption?: string,
  ) {
    if (!projectId) {
      alert("Save the project first, then save renders.");
      return;
    }
    setSaving(true);
    try {
      const row = await uploadRender({ projectId, kind, ...base64OrDataUrl, caption });
      setSaved((s) => [row, ...s]);
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeRender(r: RenderRow) {
    if (!window.confirm("Delete this render?")) return;
    try {
      await deleteRender(r);
      setSaved((s) => s.filter((x) => x.id !== r.id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <section
      style={{
        marginTop: 12,
        border: "1px solid var(--astral-line, #ddd)",
        background: "#fff",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong style={{ fontFamily: "var(--astral-mono)", fontSize: 12 }}>Vision</strong>
        <span style={{ opacity: 0.6, fontSize: 11 }}>
          sketch → model · site photo → concept render
        </span>
        <span style={{ flex: 1 }} />
        <button
          style={{ ...BTN, fontWeight: tab === "sketch" ? 700 : 400 }}
          onClick={() => setTab("sketch")}
        >
          ✎ Sketch import
        </button>
        <button
          style={{ ...BTN, fontWeight: tab === "render" ? 700 : 400 }}
          onClick={() => setTab("render")}
        >
          🌄 Site render
        </button>
      </header>

      {tab === "sketch" && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...BTN }}>
              📷 Upload sketch
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onSketchFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <input
              value={sketchNotes}
              onChange={(e) => setSketchNotes(e.target.value)}
              placeholder="Optional notes for the agent (e.g. 'plan view, dims in metres')"
              style={{ ...BTN, flex: 1, padding: "6px 8px", cursor: "text" }}
            />
            <button style={BTN} disabled={!sketchUrl || sketchBusy} onClick={runSketch}>
              {sketchBusy ? "Transcribing…" : "Transcribe →"}
            </button>
          </div>

          {sketchUrl && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Sketch</div>
                <img
                  src={sketchUrl}
                  alt="sketch"
                  style={{
                    width: "100%",
                    maxHeight: 280,
                    objectFit: "contain",
                    border: "1px solid #eee",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Proposed patches</div>
                {!sketchResult && (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    Click <em>Transcribe →</em> to extract actions. You review every one before
                    anything changes.
                  </div>
                )}
                {sketchResult?.error && (
                  <div style={{ color: "var(--astral-err, #b14)" }}>⚠ {sketchResult.error}</div>
                )}
                {sketchResult && sketchResult.actions.length === 0 && !sketchResult.error && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    No patches proposed. {sketchResult.text}
                  </div>
                )}
                {sketchResult && sketchResult.actions.length > 0 && (
                  <>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        fontSize: 11,
                        fontFamily: "var(--astral-mono)",
                      }}
                    >
                      {sketchResult.actions.map((a, i) => (
                        <li
                          key={i}
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "flex-start",
                            padding: "3px 0",
                            borderBottom: "1px solid #f0f0f0",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={pickedActions.has(i)}
                            onChange={(e) => {
                              const next = new Set(pickedActions);
                              if (e.target.checked) next.add(i);
                              else next.delete(i);
                              setPickedActions(next);
                            }}
                          />
                          <code style={{ flex: 1, wordBreak: "break-word" }}>{actionLabel(a)}</code>
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button
                        style={BTN}
                        onClick={() =>
                          setPickedActions(new Set(sketchResult.actions.map((_, i) => i)))
                        }
                      >
                        All
                      </button>
                      <button style={BTN} onClick={() => setPickedActions(new Set())}>
                        None
                      </button>
                      <span style={{ flex: 1 }} />
                      <button
                        style={{ ...BTN, fontWeight: 700 }}
                        disabled={pickedActions.size === 0}
                        onClick={applyPicked}
                      >
                        Apply {pickedActions.size}
                      </button>
                    </div>
                    {sketchResult.text && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 11, cursor: "pointer" }}>Agent notes</summary>
                        <div style={{ fontSize: 11, whiteSpace: "pre-wrap", opacity: 0.8 }}>
                          {sketchResult.text}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {projectId && sketchUrl && (
            <button
              style={{ ...BTN, alignSelf: "flex-start" }}
              disabled={saving}
              onClick={() => saveRender("sketch-import", { dataUrl: sketchUrl }, "Original sketch")}
            >
              💾 Save sketch to project
            </button>
          )}
        </div>
      )}

      {tab === "render" && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...BTN }}>
              📷 Upload site photo
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onSiteFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button style={BTN} disabled={!sitePhotoUrl || renderBusy} onClick={runRender}>
              {renderBusy ? "Rendering…" : "Render concept →"}
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, opacity: 0.6 }}>
              Description auto-derived from the live model
            </span>
          </div>

          <details>
            <summary style={{ fontSize: 11, cursor: "pointer" }}>
              Building description sent to the renderer
            </summary>
            <div
              style={{
                fontSize: 11,
                padding: "6px 8px",
                background: "#fafaf7",
                border: "1px solid #eee",
                borderRadius: 4,
                fontFamily: "var(--astral-mono)",
              }}
            >
              {description}
            </div>
          </details>

          {(sitePhotoUrl || renderOut?.imageBase64) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {sitePhotoUrl && (
                <div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Site photo</div>
                  <img
                    src={sitePhotoUrl}
                    alt="site"
                    style={{
                      width: "100%",
                      maxHeight: 320,
                      objectFit: "contain",
                      border: "1px solid #eee",
                      borderRadius: 4,
                    }}
                  />
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Concept render</div>
                {renderOut?.error && (
                  <div style={{ color: "var(--astral-err, #b14)" }}>⚠ {renderOut.error}</div>
                )}
                {renderOut?.imageBase64 && (
                  <div style={{ position: "relative" }}>
                    <img
                      src={`data:image/png;base64,${renderOut.imageBase64}`}
                      alt="concept render"
                      style={{
                        width: "100%",
                        maxHeight: 320,
                        objectFit: "contain",
                        border: "1px solid #eee",
                        borderRadius: 4,
                      }}
                    />
                    <div style={{ position: "absolute", bottom: 6, left: 6, ...PILL }}>
                      Concept render — indicative, not photorealistic
                    </div>
                  </div>
                )}
                {!renderOut && !renderBusy && (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>Awaiting render.</div>
                )}
                {renderOut?.imageBase64 && projectId && (
                  <button
                    style={{ ...BTN, marginTop: 6 }}
                    disabled={saving}
                    onClick={() =>
                      saveRender(
                        "site-render",
                        { base64: renderOut.imageBase64 },
                        "Site concept render",
                      )
                    }
                  >
                    💾 Save to project
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {saved.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>Saved on this project</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 6,
            }}
          >
            {saved.map((r) => (
              <div
                key={r.id}
                style={{ border: "1px solid #eee", borderRadius: 4, padding: 4, fontSize: 10 }}
              >
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <img
                      src={r.url}
                      alt={r.caption ?? r.kind}
                      style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 3 }}
                    />
                  </a>
                ) : (
                  <div style={{ height: 80, background: "#f4f4f4" }} />
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 3,
                  }}
                >
                  <span
                    style={{
                      ...PILL,
                      background: r.kind === "site-render" ? "#2c5d36" : "#5d3c2c",
                    }}
                  >
                    {r.kind}
                  </span>
                  <button
                    onClick={() => removeRender(r)}
                    style={{ ...BTN, padding: "1px 5px", fontSize: 10 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!user && (
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
          Sign in to save sketches and renders to a project. The transcription and render features
          work without sign-in.
        </div>
      )}
    </section>
  );
}
