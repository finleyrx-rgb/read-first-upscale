// Materials panel — Phase 7 §7.6/§7.7. Renders the live takeoff + schedules
// derived from the current model and exposes CSV/XLSX export.

import { useMemo, useState } from "react";
import { useAstral } from "@/lib/astral/store";
import { buildTakeoff } from "@/lib/astral/takeoff";
import { exportMaterialsCSV, exportMaterialsXLSX } from "@/lib/astral/materialsExport";

const BTN: React.CSSProperties = {
  padding: "6px 10px",
  background: "var(--astral-bg, #fff)",
  border: "1px solid var(--astral-line, #ccc)",
  borderRadius: 4,
  fontFamily: "var(--astral-mono)",
  fontSize: 11,
  cursor: "pointer",
};

const TH: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--astral-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  opacity: 0.7,
  padding: "4px 6px",
  borderBottom: "1px solid var(--astral-line, #ddd)",
};
const TD: React.CSSProperties = {
  fontFamily: "var(--astral-mono)",
  fontSize: 11,
  padding: "4px 6px",
  borderBottom: "1px solid var(--astral-line, #eee)",
};
const TDR: React.CSSProperties = { ...TD, textAlign: "right" };

const TABS = ["Studs", "Doors & Windows", "Lintels", "Bracing", "Fixings", "Cladding"] as const;
type Tab = typeof TABS[number];

export function MaterialsPanel() {
  const S = useAstral((s) => s);
  const t = useMemo(() => buildTakeoff(S), [S]);
  const [tab, setTab] = useState<Tab>("Studs");

  return (
    <div style={{
      border: "1px solid var(--astral-line, #ddd)",
      background: "var(--astral-pa, #fafaf7)",
      padding: 12,
      marginTop: 12,
      borderRadius: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <strong style={{ fontFamily: "var(--astral-mono)", fontSize: 12, letterSpacing: 0.4 }}>
          MATERIALS &amp; SCHEDULES
        </strong>
        <span style={{ fontFamily: "var(--astral-mono)", fontSize: 10, opacity: 0.6 }}>
          indicative · walks the model · NZS 3604 in scope
        </span>
        <span style={{ flex: 1 }} />
        <button style={BTN} onClick={() => exportMaterialsCSV(S)}>📊 CSV</button>
        <button style={BTN} onClick={() => exportMaterialsXLSX(S)}>📈 XLSX</button>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            style={{
              ...BTN,
              background: tab === tb ? "var(--astral-ink, #1d2a2a)" : BTN.background,
              color: tab === tb ? "#fff" : "inherit",
              borderColor: tab === tb ? "var(--astral-ink, #1d2a2a)" : BTN.border as string,
            }}
          >
            {tb}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        {tab === "Studs" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Wall</th>
              <th style={{ ...TH, textAlign: "right" }}>Length</th>
              <th style={{ ...TH, textAlign: "right" }}>H</th>
              <th style={{ ...TH, textAlign: "right" }}>Spacing</th>
              <th style={TH}>Size</th>
              <th style={{ ...TH, textAlign: "right" }}>Common</th>
              <th style={{ ...TH, textAlign: "right" }}>Jack</th>
              <th style={{ ...TH, textAlign: "right" }}>Trimmer</th>
              <th style={{ ...TH, textAlign: "right" }}>Corner</th>
              <th style={{ ...TH, textAlign: "right" }}>Nogs (lm)</th>
              <th style={{ ...TH, textAlign: "right" }}>Plates (lm)</th>
            </tr></thead>
            <tbody>
              {t.studs.map((l) => (
                <tr key={l.wall}>
                  <td style={TD}>{l.wallName}</td>
                  <td style={TDR}>{l.length_mm}</td>
                  <td style={TDR}>{l.height_mm}</td>
                  <td style={TDR}>@{l.spacing_mm}</td>
                  <td style={TD}>{l.size}</td>
                  <td style={TDR}>{l.common}</td>
                  <td style={TDR}>{l.jack}</td>
                  <td style={TDR}>{l.trimmer}</td>
                  <td style={TDR}>{l.corner}</td>
                  <td style={TDR}>{l.nogs_lm}</td>
                  <td style={TDR}>{l.plates_lm}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...TD, fontWeight: 600 }}>TOTAL</td>
                <td style={TDR} colSpan={3}></td>
                <td style={{ ...TD, fontWeight: 600 }}>{t.studTotals.size}</td>
                <td style={{ ...TDR, fontWeight: 600 }}>{t.studTotals.studs_pcs} pcs</td>
                <td style={TDR} colSpan={3}>≈ {t.studTotals.studs_lm} lm</td>
                <td style={{ ...TDR, fontWeight: 600 }}>{t.studTotals.nogs_lm}</td>
                <td style={{ ...TDR, fontWeight: 600 }}>{t.studTotals.plates_lm}</td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === "Doors & Windows" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Ref</th><th style={TH}>Kind</th><th style={TH}>Wall</th>
              <th style={{ ...TH, textAlign: "right" }}>W</th>
              <th style={{ ...TH, textAlign: "right" }}>H</th>
              <th style={{ ...TH, textAlign: "right" }}>Head</th>
              <th style={{ ...TH, textAlign: "right" }}>Sill</th>
              <th style={{ ...TH, textAlign: "right" }}>Off</th>
              <th style={{ ...TH, textAlign: "right" }}>Area (m²)</th>
            </tr></thead>
            <tbody>
              {t.openings.map((o) => (
                <tr key={o.ref}>
                  <td style={{ ...TD, fontWeight: 600 }}>{o.ref}</td>
                  <td style={TD}>{o.kind}</td>
                  <td style={TD}>{o.wallName}</td>
                  <td style={TDR}>{o.width_mm}</td>
                  <td style={TDR}>{o.height_mm}</td>
                  <td style={TDR}>{o.head_mm}</td>
                  <td style={TDR}>{o.sill_mm}</td>
                  <td style={TDR}>{o.off_mm}</td>
                  <td style={TDR}>{o.area_m2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Lintels" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Ref</th><th style={TH}>Size</th>
              <th style={{ ...TH, textAlign: "right" }}>Span</th>
              <th style={{ ...TH, textAlign: "right" }}>Count</th>
              <th style={{ ...TH, textAlign: "right" }}>Length each</th>
              <th style={{ ...TH, textAlign: "right" }}>Total (lm)</th>
              <th style={TH}>SED</th>
            </tr></thead>
            <tbody>
              {t.lintels.map((r) => (
                <tr key={r.ref}>
                  <td style={{ ...TD, fontWeight: 600 }}>{r.ref}</td>
                  <td style={TD}>{r.size}</td>
                  <td style={TDR}>{r.span_mm}</td>
                  <td style={TDR}>{r.count}</td>
                  <td style={TDR}>{r.length_per_mm}</td>
                  <td style={TDR}>{r.total_lm}</td>
                  <td style={TD}>{r.sed ? <span style={{ color: "var(--astral-warn, #c25a3a)" }}>SED</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Bracing" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Wall</th>
              <th style={{ ...TH, textAlign: "right" }}>Length</th>
              <th style={{ ...TH, textAlign: "right" }}>Available</th>
              <th style={{ ...TH, textAlign: "right" }}>Panels</th>
              <th style={{ ...TH, textAlign: "right" }}>BU</th>
              <th style={TH}>SED</th>
            </tr></thead>
            <tbody>
              {t.bracing.map((b) => (
                <tr key={b.wall}>
                  <td style={TD}>{b.wallName}</td>
                  <td style={TDR}>{b.length_mm}</td>
                  <td style={TDR}>{b.available_mm}</td>
                  <td style={TDR}>{b.panels}</td>
                  <td style={TDR}>{b.bu}</td>
                  <td style={TD}>{b.sed ? <span style={{ color: "var(--astral-warn, #c25a3a)" }}>SED</span> : ""}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...TD, fontWeight: 600 }}>TOTAL</td>
                <td style={TDR} colSpan={3}></td>
                <td style={{ ...TDR, fontWeight: 600 }}>{t.bracingTotalBU}</td>
                <td style={TD}></td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === "Fixings" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Item</th>
              <th style={{ ...TH, textAlign: "right" }}>Qty</th>
              <th style={TH}>Unit</th>
              <th style={TH}>Note</th>
            </tr></thead>
            <tbody>
              {t.fixings.map((f, i) => (
                <tr key={i}>
                  <td style={TD}>{f.item}</td>
                  <td style={TDR}>{f.qty}</td>
                  <td style={TD}>{f.unit}</td>
                  <td style={TD}>{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Cladding" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Item</th>
              <th style={{ ...TH, textAlign: "right" }}>Gross (m²)</th>
              <th style={{ ...TH, textAlign: "right" }}>Openings</th>
              <th style={{ ...TH, textAlign: "right" }}>Net</th>
              <th style={{ ...TH, textAlign: "right" }}>Waste %</th>
              <th style={{ ...TH, textAlign: "right" }}>Order</th>
              <th style={TH}>Spec</th>
            </tr></thead>
            <tbody>
              {t.areas.map((a, i) => (
                <tr key={i}>
                  <td style={TD}>{a.item}</td>
                  <td style={TDR}>{a.gross_m2}</td>
                  <td style={TDR}>{a.openings_m2}</td>
                  <td style={TDR}>{a.net_m2}</td>
                  <td style={TDR}>{a.waste_pct}%</td>
                  <td style={{ ...TDR, fontWeight: 600 }}>{a.order_m2}</td>
                  <td style={TD}>{a.spec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
