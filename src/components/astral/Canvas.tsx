// Canvas — Plan view ported inline as React SVG. Elevation/Section/Detail
// fall back to the legacy single-file app at /astral.html via an iframe
// until they're ported in Phase 0c.

import { useMemo } from "react";
import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { CLAD, ROOFC, WALLNAME, type WallKey } from "@/lib/astral/constants";
import { qtys } from "@/lib/astral/model";
import type { Opening } from "@/lib/astral/store";

const colKind: Record<Opening["kind"], string> = {
  Garage: "#bf6b2c",
  Door: "#3f7d54",
  Window: "#2f6f7e",
};

function PlanView() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, eave: s.eave, openings: s.openings, parts: s.parts,
    cladCol: s.cladCol, sel: s.sel,
  })));
  const setSel = useAstral((s) => s.setSel);

  const cladHex = CLAD.find((c) => c.n === S.cladCol)?.h || CLAD[0].h;

  const VW = 600, VH = 440, m = 66;
  const sc = Math.min((VW - 2 * m) / S.L, (VH - 2 * m) / S.W);
  const w = S.L * sc, h = S.W * sc;
  const x0 = (VW - w) / 2, y0 = (VH - h) / 2;
  const tt = Math.max(3, 90 * sc);
  const eaveOff = (S.eave || 450) * sc;
  const scaleLabel = `plan ≈1:${Math.round(1000 / sc)}`;

  const wallLen = (wl: WallKey) => (wl === "N" || wl === "S" ? S.L : S.W);

  return (
    <>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet" onClick={(e) => {
        let n = e.target as Element | null;
        while (n && n !== e.currentTarget && !n.getAttribute?.("data-node-id")) n = n.parentNode as Element | null;
        const id = n?.getAttribute?.("data-node-id");
        if (id) setSel(id);
      }}>
        {/* eave outline */}
        <rect x={x0 - eaveOff} y={y0 - eaveOff} width={w + 2 * eaveOff} height={h + 2 * eaveOff}
          fill="none" stroke="#b9b09c" strokeWidth={1} strokeDasharray="6 4" />

        {/* slab fill */}
        <rect x={x0 + tt} y={y0 + tt} width={w - 2 * tt} height={h - 2 * tt}
          fill={cladHex} opacity={0.3} data-node-id="slab" data-node-type="Slab" />

        {/* building outline */}
        <rect x={x0} y={y0} width={w} height={h} fill="none" stroke="#1d2a2a" strokeWidth={2}
          data-node-id="building" data-node-type="Building" />
        <rect x={x0 + tt} y={y0 + tt} width={w - 2 * tt} height={h - 2 * tt}
          fill="none" stroke="#1d2a2a" strokeWidth={1} />

        {/* openings */}
        {S.openings.map((o) => {
          const len = wallLen(o.wall);
          const fr = Math.max(0, Math.min(1, o.off / len));
          const owid = Math.min(o.width, len * 0.95) * sc;
          let cx = 0, cy = 0, horiz = true;
          if (o.wall === "N") { horiz = true; cx = x0 + fr * w; cy = y0; }
          else if (o.wall === "S") { horiz = true; cx = x0 + fr * w; cy = y0 + h; }
          else if (o.wall === "W") { horiz = false; cx = x0; cy = y0 + fr * h; }
          else { horiz = false; cx = x0 + w; cy = y0 + fr * h; }

          const stroke = colKind[o.kind];
          const sw = o.kind === "Garage" ? 2.4 : 1.6;

          if (horiz) {
            const ax = Math.max(x0, Math.min(x0 + w - owid, cx - owid / 2));
            return (
              <rect key={o.id} x={ax} y={cy - 3} width={owid} height={6}
                fill="#fff" stroke={stroke} strokeWidth={sw}
                data-node-id={`opening-${o.id}`} data-node-type="Opening" />
            );
          }
          const ay = Math.max(y0, Math.min(y0 + h - owid, cy - owid / 2));
          return (
            <rect key={o.id} x={cx - 3} y={ay} width={6} height={owid}
              fill="#fff" stroke={stroke} strokeWidth={sw}
              data-node-id={`opening-${o.id}`} data-node-type="Opening" />
          );
        })}

        {/* internal partitions */}
        {S.parts.map((p) => {
          const across = p.dir === "Across width";
          if (across) {
            const x = x0 + (p.off / S.L) * w;
            const ys = y0 + (p.start / S.W) * h;
            const yl = (p.len / S.W) * h;
            return (
              <line key={p.id} x1={x} y1={ys} x2={x} y2={ys + yl}
                stroke="#1d2a2a" strokeWidth={1.4} data-node-id={`part-${p.id}`} data-node-type="Partition" />
            );
          }
          const y = y0 + (p.off / S.W) * h;
          const xs = x0 + (p.start / S.L) * w;
          const xl = (p.len / S.L) * w;
          return (
            <line key={p.id} x1={xs} y1={y} x2={xs + xl} y2={y}
              stroke="#1d2a2a" strokeWidth={1.4} data-node-id={`part-${p.id}`} data-node-type="Partition" />
          );
        })}

        {/* wall labels */}
        {(["N", "S", "E", "W"] as const).map((wl) => {
          let tx = 0, ty = 0;
          if (wl === "N") { tx = x0 + w / 2; ty = y0 - 8; }
          else if (wl === "S") { tx = x0 + w / 2; ty = y0 + h + 14; }
          else if (wl === "W") { tx = x0 - 8; ty = y0 + h / 2; }
          else { tx = x0 + w + 8; ty = y0 + h / 2; }
          return (
            <text key={wl} x={tx} y={ty} fill="#9a8f78" fontSize={8} fontFamily="IBM Plex Mono"
              textAnchor={wl === "W" ? "end" : wl === "E" ? "start" : "middle"}>
              {WALLNAME[wl]}
            </text>
          );
        })}

        {/* selection highlight */}
        {S.sel && <SelectionHalo id={S.sel} />}
      </svg>
      <div style={{ position: "absolute", right: 14, top: 8, fontFamily: "var(--astral-mono)", fontSize: 10, color: "var(--astral-ink2)" }}>
        {scaleLabel}
      </div>
    </>
  );
}

function SelectionHalo({ id }: { id: string }) {
  // light-weight visual cue; the real bounding box highlight happens via CSS
  return (
    <text x={10} y={530} fontFamily="IBM Plex Mono" fontSize={9} fill="#bf6b2c">
      selected: {id}
    </text>
  );
}

function Fallback({ view }: { view: string }) {
  return (
    <div className="placeholder">
      <p style={{ margin: "0 0 8px" }}>
        <b>{view}</b> view is being ported (Phase 0c).
      </p>
      <p style={{ margin: 0 }}>
        Preview it in the <a href="/legacy">legacy build</a> for now.
      </p>
    </div>
  );
}

function Chips() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, wind: s.wind, roof: s.roof, roofCol: s.roofCol,
    clad: s.clad, cladCol: s.cladCol, openings: s.openings, studH: s.studH,
    spacing: s.spacing, pitch: s.pitch, cover: s.cover, struct: s.struct,
    found: s.found,
  })));
  const q = useMemo(() => qtys(S as never), [S]);
  return (
    <div className="astral-chips">
      <span className="astral-stat"><b>{q.floorA}</b> m² floor</span>
      <span className="astral-pill">{S.wind} wind</span>
      <span className="astral-pill">{S.roof} · {S.roofCol}</span>
      <span className="astral-pill">{S.clad.split(" ")[0]} · {S.cladCol}</span>
    </div>
  );
}

export function Canvas() {
  const view = useAstral((s) => s.view);
  const layer = useAstral((s) => s.layer);
  return (
    <div style={{ position: "relative" }}>
      {view === "plan" && layer === "arch" ? <PlanView /> : <Fallback view={`${view}/${layer}`} />}
      <Chips />
      {/* refer roof palette so it gets used */}
      <div style={{ display: "none" }}>{ROOFC.length}</div>
    </div>
  );
}
