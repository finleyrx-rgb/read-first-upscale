// Phase C — Plan ingestion panel.
// Upload PDFs/images, render PDF pages to thumbnails client-side, analyse each
// with the vision LLM, and review proposed AgentActions in a diff card before
// applying them to the live model.

import { useEffect, useState } from "react";
import { useAstral } from "@/lib/astral/store";
import { renderPdfPages, fileToDataUrl, type RenderedPage } from "@/lib/astral/sources/pdf";
import {
  uploadSource,
  listSources,
  deleteSource,
  saveAnalysis,
  signedUrl,
  type ProjectSource,
} from "@/lib/astral/sources/sources";
import type { PageAnalysis, PageKind } from "@/lib/astral/sources/types";
import { analyzePlanPage } from "@/lib/astral/planAnalysis.functions";
import { applyAction, type AgentAction } from "@/lib/astral/agent/grammar";
import { exportAllPDF } from "@/lib/astral/exporters";

const BTN: React.CSSProperties = {
  padding: "6px 10px",
  background: "#fff",
  border: "1px solid var(--astral-line, #ccc)",
  borderRadius: 4,
  fontFamily: "var(--astral-mono)",
  fontSize: 11,
  cursor: "pointer",
};

type LocalSource = ProjectSource & {
  pages?: RenderedPage[]; // session-only thumbnails
  busy?: boolean;
};

function actionLabel(a: AgentAction): string {
  const parts: string[] = [a.verb];
  for (const [k, v] of Object.entries(a)) {
    if (k === "verb") continue;
    parts.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(" ");
}

function confidenceColor(c: number): string {
  if (c >= 0.75) return "#1d6f3c";
  if (c >= 0.6) return "#9c7a16";
  return "#b14";
}

export function PlansPanel({ projectId }: { projectId: string | null }) {
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, Set<number>>>({}); // sourceId → set of action indices (global across pages)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!projectId) {
      setSources([]);
      return;
    }
    listSources(projectId)
      .then((rs) => setSources(rs as LocalSource[]))
      .catch(() => {});
  }, [projectId]);

  async function refreshPreview(s: ProjectSource) {
    if (previewUrls[s.id]) return;
    const url = await signedUrl(s.storage_path, 900);
    if (url) setPreviewUrls((m) => ({ ...m, [s.id]: url }));
  }

  async function onFiles(files: FileList | null) {
    if (!projectId) {
      alert("Save the project first, then upload plans.");
      return;
    }
    if (!files) return;
    for (const f of Array.from(files)) {
      const kind = f.type === "application/pdf" ? "pdf" : "image";
      try {
        let pages: RenderedPage[] = [];
        let pageCount = 1;
        if (kind === "pdf") {
          pages = await renderPdfPages(f);
          pageCount = pages.length;
        } else {
          const url = await fileToDataUrl(f);
          pages = [{ index: 1, dataUrl: url, width: 0, height: 0 }];
        }
        const row = await uploadSource({ projectId, file: f, pageCount, kind });
        setSources((s) => [{ ...row, pages } as LocalSource, ...s]);
      } catch (e) {
        alert(`Upload failed: ${(e as Error).message}`);
      }
    }
  }

  async function analyse(s: LocalSource) {
    // If we don't have pages in memory (re-loaded from DB), fetch + re-render.
    let pages = s.pages;
    if (!pages || pages.length === 0) {
      if (s.kind !== "pdf") {
        const url = await signedUrl(s.storage_path);
        if (!url) {
          alert("Could not fetch source file.");
          return;
        }
        // For image sources we just analyse the file directly via fetch → dataURL.
        const blob = await (await fetch(url)).blob();
        const dataUrl = await fileToDataUrl(new File([blob], s.original_filename, { type: blob.type }));
        pages = [{ index: 1, dataUrl, width: 0, height: 0 }];
      } else {
        const url = await signedUrl(s.storage_path);
        if (!url) {
          alert("Could not fetch PDF.");
          return;
        }
        const blob = await (await fetch(url)).blob();
        pages = await renderPdfPages(new File([blob], s.original_filename, { type: "application/pdf" }));
      }
      setSources((all) => all.map((x) => (x.id === s.id ? { ...x, pages } : x)));
    }
    setSources((all) => all.map((x) => (x.id === s.id ? { ...x, busy: true } : x)));
    setLoading(true);
    try {
      const analyses: PageAnalysis[] = [];
      for (const p of pages) {
        const a = await analyzePlanPage({
          data: {
            imageDataUrl: p.dataUrl,
            pageIndex: p.index,
            filename: s.original_filename,
          },
        });
        analyses.push(a);
      }
      await saveAnalysis(s.id, analyses);
      // Pre-tick high-confidence proposed actions.
      const flat: number[] = [];
      let i = 0;
      for (const a of analyses) {
        for (const _ of a.proposedActions) {
          if (a.confidence >= 0.6) flat.push(i);
          i++;
        }
      }
      setPicked((m) => ({ ...m, [s.id]: new Set(flat) }));
      setSources((all) => all.map((x) => (x.id === s.id ? { ...x, analysis: analyses, busy: false } : x)));
    } catch (e) {
      alert(`Analysis failed: ${(e as Error).message}`);
      setSources((all) => all.map((x) => (x.id === s.id ? { ...x, busy: false } : x)));
    } finally {
      setLoading(false);
    }
  }

  function applyPicked(s: LocalSource) {
    const sel = picked[s.id] ?? new Set<number>();
    if (sel.size === 0) return;
    const store = useAstral.getState();
    const flat: AgentAction[] = [];
    for (const a of s.analysis) flat.push(...a.proposedActions);
    let applied = 0;
    sel.forEach((idx) => {
      const action = flat[idx];
      if (!action) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applyAction(store as unknown as Parameters<typeof applyAction>[0], action);
        applied++;
      } catch (e) {
        console.error("apply failed", action, e);
      }
    });
    // Mark the project as elaborated-from-source so every sheet carries the
    // "ELABORATED FROM SOURCE PLAN" watermark instead of "CONCEPT".
    if (applied > 0) store.patch({ sourceElaborated: true, mode: "build" });
    alert(`Applied ${applied}/${sel.size} actions to the live model.`);
    setPicked((m) => ({ ...m, [s.id]: new Set() }));
  }

  /** Map a source page's kind to a Build-view patch so the user can compare the
   *  uploaded page to Astral's equivalent rendering of the live model. */
  function compareOnCanvas(a: PageAnalysis) {
    const patch: Record<string, unknown> = { mode: "build", detailFor: null };
    const faceMap: Record<string, "front" | "back" | "left" | "right"> = {
      S: "front", N: "back", W: "left", E: "right",
    };
    switch (a.kind as PageKind) {
      case "floor-plan":
        patch.view = "plan"; patch.layer = "arch"; break;
      case "elevation":
        patch.view = "elevation"; patch.layer = "arch";
        if (a.faceCompass && faceMap[a.faceCompass]) patch.face = faceMap[a.faceCompass];
        break;
      case "section":
        patch.view = "section"; patch.cut = "cross"; break;
      case "detail":
        patch.view = "detail"; break;
      case "schedule":
      default:
        patch.view = "plan"; patch.layer = "arch";
    }
    useAstral.getState().patch(patch);
  }

  async function elaborateAll() {
    useAstral.getState().patch({ sourceElaborated: true });
    try {
      await exportAllPDF("astral-elaborated-set.pdf");
    } catch (e) {
      alert(`Elaboration export failed: ${(e as Error).message}`);
    }
  }

  function jumpTo(view: string, layer?: string, face?: string) {
    const p: Record<string, unknown> = { mode: "build", view, detailFor: null };
    if (layer) p.layer = layer;
    if (face) p.face = face;
    useAstral.getState().patch(p);
  }

  async function remove(s: LocalSource) {
    if (!window.confirm(`Delete "${s.original_filename}" and its analysis?`)) return;
    try {
      await deleteSource(s);
      setSources((all) => all.filter((x) => x.id !== s.id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (!projectId) {
    return (
      <div style={{ fontSize: 12, opacity: 0.7, padding: 8 }}>
        Save the project first (top bar · Projects), then upload plans here.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontFamily: "var(--astral-mono)", fontSize: 12 }}>Source plans</strong>
        <span style={{ opacity: 0.6, fontSize: 11 }}>
          upload existing PDFs/images → vision LLM extracts a model proposal
        </span>
        <span style={{ flex: 1 }} />
        <label style={{ ...BTN, fontWeight: 700 }}>
          ＋ Upload plans
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </header>

      <div
        style={{
          fontSize: 10,
          padding: "6px 8px",
          background: "#fffbe6",
          border: "1px solid #f0d97a",
          borderRadius: 4,
          fontFamily: "var(--astral-mono)",
        }}
      >
        Source plans are the original author's IP. Astral analyses them for your working use only —
        the extracted model is approximate and every patch is reviewable before it is applied.
      </div>

      {/* Phase C4 — Elaboration shortcuts. Once the model has been populated
          from source plans, the user can generate more drawings than the
          original set contained, all watermarked "ELABORATED FROM SOURCE". */}
      <div
        style={{
          padding: 8,
          border: "1px dashed var(--astral-line, #ccc)",
          borderRadius: 4,
          background: "#fafaf7",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontFamily: "var(--astral-mono)", fontSize: 11, fontWeight: 700 }}>
          Elaborate from extracted model
        </div>
        <div style={{ fontSize: 10, opacity: 0.7 }}>
          Generates more drawings than the source set contained — all four elevations, sections,
          construction details, framing &amp; foundation plans. Watermarked accordingly.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button style={BTN} onClick={() => jumpTo("elevation", "arch", "front")}>
            ▢ All elevations
          </button>
          <button style={BTN} onClick={() => jumpTo("section", undefined, undefined)}>
            ⊢ Sections
          </button>
          <button style={BTN} onClick={() => jumpTo("detail")}>
            ◇ Details
          </button>
          <button style={BTN} onClick={() => jumpTo("plan", "framing")}>
            ▦ Framing plan
          </button>
          <button style={BTN} onClick={() => jumpTo("plan", "foundation")}>
            ▤ Foundation plan
          </button>
          <span style={{ flex: 1 }} />
          <button style={{ ...BTN, fontWeight: 700 }} onClick={elaborateAll}>
            📄 Full elaborated PDF set
          </button>
        </div>
      </div>

      {sources.length === 0 && (
        <div style={{ fontSize: 12, opacity: 0.6, padding: 12, textAlign: "center" }}>
          No plans uploaded yet. Drop a multi-page PDF (consent set, MultiProof, etc.) to begin.
        </div>
      )}

      {sources.map((s) => {
        const hasAnalysis = (s.analysis?.length ?? 0) > 0;
        let actionCursor = 0;
        const pickedSet = picked[s.id] ?? new Set<number>();
        return (
          <article
            key={s.id}
            style={{
              border: "1px solid var(--astral-line, #ddd)",
              borderRadius: 6,
              padding: 10,
              background: "#fff",
            }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 12 }}>{s.original_filename}</strong>
              <span style={{ fontSize: 11, opacity: 0.6 }}>
                {s.kind.toUpperCase()} · {s.page_count} page{s.page_count > 1 ? "s" : ""}
              </span>
              <span style={{ flex: 1 }} />
              <button
                style={BTN}
                disabled={s.busy || loading}
                onClick={() => analyse(s)}
              >
                {s.busy ? "Analysing…" : hasAnalysis ? "Re-analyse" : "Analyse →"}
              </button>
              <button style={BTN} onClick={() => refreshPreview(s)}>
                Preview
              </button>
              <button style={{ ...BTN, color: "#b14" }} onClick={() => remove(s)}>
                Delete
              </button>
            </header>

            {previewUrls[s.id] && (
              <div style={{ marginTop: 8 }}>
                {s.kind === "image" ? (
                  <img
                    src={previewUrls[s.id]}
                    alt={s.original_filename}
                    style={{ maxWidth: "100%", maxHeight: 320, border: "1px solid #eee" }}
                  />
                ) : (
                  <a href={previewUrls[s.id]} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                    Open original PDF ↗
                  </a>
                )}
              </div>
            )}

            {s.pages && s.pages.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {s.pages.map((p) => (
                  <div key={p.index} style={{ border: "1px solid #eee", padding: 2 }}>
                    <img
                      src={p.dataUrl}
                      alt={`p${p.index}`}
                      style={{ width: "100%", display: "block" }}
                    />
                    <div style={{ fontSize: 9, opacity: 0.6, textAlign: "center" }}>p{p.index}</div>
                  </div>
                ))}
              </div>
            )}

            {hasAnalysis && (
              <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 8 }}>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                  Analysis diff — review each patch before applying.
                </div>
                {s.analysis.map((a) => {
                  const lowConf = a.confidence < 0.6;
                  return (
                    <details
                      key={a.pageIndex}
                      open
                      style={{
                        marginBottom: 6,
                        padding: 6,
                        background: lowConf ? "#fffbe6" : "#fafaf7",
                        border: "1px solid " + (lowConf ? "#f0d97a" : "#eee"),
                        borderRadius: 4,
                      }}
                    >
                      <summary style={{ cursor: "pointer", fontSize: 11 }}>
                        <strong>Page {a.pageIndex}</strong> · {a.kind}
                        {a.faceCompass ? ` · ${a.faceCompass}` : ""}
                        {a.scale ? ` · ${a.scale}` : ""}{" "}
                        <span style={{ color: confidenceColor(a.confidence), fontWeight: 700 }}>
                          conf {(a.confidence * 100).toFixed(0)}%
                        </span>{" "}
                        · {a.proposedActions.length} patch
                        {a.proposedActions.length === 1 ? "" : "es"}
                        {lowConf && " · ⚠ low confidence — review manually"}
                      </summary>
                      {a.error && (
                        <div style={{ color: "#b14", fontSize: 11, marginTop: 4 }}>⚠ {a.error}</div>
                      )}
                      {a.summary && (
                        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{a.summary}</div>
                      )}
                      <div style={{ marginTop: 4 }}>
                        <button
                          style={{ ...BTN, fontSize: 10, padding: "3px 6px" }}
                          onClick={() => compareOnCanvas(a)}
                          title="Switch the canvas to Astral's equivalent view so you can compare it side-by-side with the source page above"
                        >
                          ↔ Compare on canvas
                        </button>
                      </div>
                      {a.notes && a.notes.length > 0 && (
                        <ul style={{ fontSize: 11, margin: "4px 0", paddingLeft: 16 }}>
                          {a.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                      {a.proposedActions.length > 0 && (
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: "6px 0 0",
                            fontSize: 11,
                            fontFamily: "var(--astral-mono)",
                          }}
                        >
                          {a.proposedActions.map((act) => {
                            const idx = actionCursor++;
                            return (
                              <li
                                key={idx}
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  padding: "2px 0",
                                  borderBottom: "1px dashed #f0f0f0",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={pickedSet.has(idx)}
                                  onChange={(e) => {
                                    const next = new Set(pickedSet);
                                    if (e.target.checked) next.add(idx);
                                    else next.delete(idx);
                                    setPicked((m) => ({ ...m, [s.id]: next }));
                                  }}
                                />
                                <code style={{ flex: 1, wordBreak: "break-word" }}>
                                  {actionLabel(act)}
                                </code>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </details>
                  );
                })}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    style={BTN}
                    onClick={() => {
                      const all = new Set<number>();
                      let i = 0;
                      for (const a of s.analysis) for (const _ of a.proposedActions) all.add(i++);
                      setPicked((m) => ({ ...m, [s.id]: all }));
                    }}
                  >
                    All
                  </button>
                  <button
                    style={BTN}
                    onClick={() => setPicked((m) => ({ ...m, [s.id]: new Set() }))}
                  >
                    None
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    style={{ ...BTN, fontWeight: 700 }}
                    disabled={pickedSet.size === 0}
                    onClick={() => applyPicked(s)}
                  >
                    Apply {pickedSet.size} to model
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
