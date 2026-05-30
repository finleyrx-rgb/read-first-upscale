// ExportBar — share link, named presets, PNG/PDF/CSV export.
// Sits between the header and the canvas stage.

import { useState } from "react";
import { useAstral } from "@/lib/astral/store";
import {
  shareUrl, listPresets, savePreset, deletePreset, type NamedPreset,
} from "@/lib/astral/persistence";
import { exportCurrentPNG, exportAllPDF, exportBOMCsv } from "@/lib/astral/exporters";

const BTN: React.CSSProperties = {
  padding: "6px 10px",
  background: "var(--astral-bg, #fff)",
  border: "1px solid var(--astral-line, #ccc)",
  borderRadius: 4,
  fontFamily: "var(--astral-mono)",
  fontSize: 11,
  cursor: "pointer",
};

export function ExportBar() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [presets, setPresets] = useState<NamedPreset[]>(() => listPresets());

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2200);
  };

  const onShare = async () => {
    const s = useAstral.getState();
    const url = shareUrl(s);
    try {
      await navigator.clipboard.writeText(url);
      flash("Share link copied to clipboard");
    } catch {
      window.prompt("Share link:", url);
    }
  };

  const onPNG = async () => {
    setBusy("png");
    try {
      await exportCurrentPNG(`astral-${useAstral.getState().view}.png`);
      flash("PNG downloaded");
    } catch (e) { flash(`PNG failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  const onPDF = async () => {
    setBusy("pdf");
    try {
      await exportAllPDF("astral-drawing-set.pdf");
      flash("PDF set downloaded");
    } catch (e) { flash(`PDF failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  const onCSV = () => {
    exportBOMCsv(useAstral.getState(), "astral-quantities.csv");
    flash("Quantities CSV downloaded");
  };

  const onSavePreset = () => {
    const name = window.prompt("Preset name:", `Project ${new Date().toLocaleDateString()}`);
    if (!name) return;
    setPresets(savePreset(name, useAstral.getState()));
    flash(`Saved “${name}”`);
  };

  const onLoadPreset = (name: string) => {
    const p = listPresets().find((x) => x.name === name);
    if (!p) return;
    useAstral.getState().patch(p.data);
    flash(`Loaded “${name}”`);
  };

  const onDeletePreset = (name: string) => {
    if (!window.confirm(`Delete preset “${name}”?`)) return;
    setPresets(deletePreset(name));
    flash(`Deleted “${name}”`);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "6px 14px",
        borderTop: "1px solid var(--astral-line, #ddd)",
        borderBottom: "1px solid var(--astral-line, #ddd)",
        background: "var(--astral-pa, #fafaf7)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: "var(--astral-mono)", fontSize: 11, opacity: 0.7, marginRight: 4 }}>
        project
      </span>
      <button style={BTN} onClick={onShare}>🔗 Share link</button>
      <button style={BTN} onClick={onSavePreset}>＋ Save preset</button>
      {presets.length > 0 && (
        <select
          style={{ ...BTN, padding: "6px 8px" }}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("del:")) onDeletePreset(v.slice(4));
            else if (v) onLoadPreset(v);
            e.currentTarget.value = "";
          }}
        >
          <option value="">Load preset…</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>↻ {p.name}</option>
          ))}
          <option disabled>──────────</option>
          {presets.map((p) => (
            <option key={`d-${p.name}`} value={`del:${p.name}`}>✕ delete “{p.name}”</option>
          ))}
        </select>
      )}

      <span style={{ flex: 1 }} />

      <span style={{ fontFamily: "var(--astral-mono)", fontSize: 11, opacity: 0.7 }}>export</span>
      <button style={BTN} onClick={onPNG} disabled={busy !== null}>
        {busy === "png" ? "…" : "🖼 PNG"}
      </button>
      <button style={BTN} onClick={onPDF} disabled={busy !== null}>
        {busy === "pdf" ? "rendering sheets…" : "📄 PDF set"}
      </button>
      <button style={BTN} onClick={onCSV} disabled={busy !== null}>📊 CSV</button>

      {msg && (
        <span style={{ fontFamily: "var(--astral-mono)", fontSize: 11, color: "var(--astral-ok, #3f7d54)" }}>
          {msg}
        </span>
      )}
    </div>
  );
}
