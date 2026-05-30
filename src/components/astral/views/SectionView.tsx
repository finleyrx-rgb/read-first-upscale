import React from "react";
// Section view — ported from drawSection() in public/astral.html.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { KIND_COL, openFrac, openingOH, openingSill } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";

const VW = 600, VH = 440, m = 70;

export function SectionView() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, studH: s.studH, eave: s.eave,
    roof: s.roof, pitch: s.pitch, cut: s.cut, openings: s.openings,
  })));

  const cut = S.cut === "long" ? "long" : "cross";
  const widmm = cut === "cross" ? S.W : S.L;
  const apexmm = cut === "cross"
    ? (S.W / 2) * Math.tan((S.pitch * Math.PI) / 180)
    : S.roof === "Mono"
      ? S.L * Math.tan((S.pitch * Math.PI) / 180)
      : (S.W / 2) * Math.tan((S.pitch * Math.PI) / 180);
  const slabT = 100, footing = 200;
  const totH = S.studH + (S.roof === "Flat" ? 200 : apexmm) + slabT + footing;
  const sc = Math.min((VW - 2 * m) / widmm, (VH - 2 * m) / totH);
  const w = widmm * sc, eh = S.studH * sc;
  const x0 = (VW - w) / 2, base = VH - m - footing * sc;
  const eave = base - eh, apexP = apexmm * sc;
  const tag = cut === "cross" ? "A" : "B";

  let rpts: [number, number][];
  let ridgeLine: { y: number } | null = null;
  const eaveOff = (S.eave || 450) * sc;
  if (S.roof === "Flat") {
    rpts = [[x0 - eaveOff, eave - 6], [x0 + w + eaveOff, eave - 6], [x0 + w + eaveOff, eave - 2], [x0 - eaveOff, eave - 2]];
  } else if (S.roof === "Mono") {
    const r = widmm * Math.tan((S.pitch * Math.PI) / 180) * sc;
    rpts = [
      [x0 - eaveOff, eave - (cut === "cross" ? Math.min(r, apexP * 2) : 0)],
      [x0 + w + eaveOff, eave],
      [x0 + w + eaveOff, eave + 4],
      [x0 - eaveOff, eave + 4],
    ];
  } else if (cut === "long" && (S.roof === "Gable" || S.roof === "Hip")) {
    rpts = [
      [x0 - eaveOff, eave - apexP * 0.05], [x0 + w + eaveOff, eave - apexP * 0.05],
      [x0 + w + eaveOff, eave], [x0 - eaveOff, eave],
    ];
    ridgeLine = { y: eave - apexP };
  } else {
    rpts = [[x0 - eaveOff, eave], [x0 + w / 2, eave - apexP], [x0 + w + eaveOff, eave]];
  }

  const wallT = Math.max(3, 90 * sc);
  const seenWalls = cut === "cross" ? ["N", "S"] : ["W", "E"];
  const projected = S.openings.filter((o) => seenWalls.indexOf(o.wall) >= 0);

  const earthHatch: React.ReactElement[] = [];
  for (let xx = x0 - 30; xx < x0 + w + 30; xx += 8) {
    earthHatch.push(<line key={xx} x1={xx} y1={base + (slabT + footing) * sc} x2={xx + 5} y2={base + (slabT + footing) * sc + 5} stroke="#7a6f57" strokeWidth={0.4} />);
  }

  const trusses: React.ReactElement[] = [];
  if (S.roof !== "Flat" && cut === "long") {
    const tspx = 900 * sc; let i = 0;
    for (let x = x0 + tspx; x < x0 + w; x += tspx) {
      trusses.push(<line key={i++} x1={x} y1={eave} x2={x} y2={eave - apexP * 0.18} stroke="#c8975a" strokeWidth={0.5} />);
    }
  }

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        {/* ground, slab, thickened edges */}
        <line x1={x0 - 40} y1={base} x2={x0 + w + 40} y2={base} stroke="#1d2a2a" strokeWidth={1.4} />
        <rect x={x0} y={base} width={w} height={slabT * sc} fill="#efeadd" stroke="#1d2a2a" strokeWidth={1.1}
          data-node-id="slab" data-node-type="Slab" />
        {[[x0, 1], [x0 + w, -1]].map(([xe, d], i) => (
          <rect key={i} x={d > 0 ? xe : xe - 14} y={base} width={14} height={(slabT + footing) * sc}
            fill="#efeadd" stroke="#1d2a2a" strokeWidth={1.1} />
        ))}
        <text x={x0 + w + 44} y={base + 3} fill="#3c4a47" fontSize={9} fontFamily="IBM Plex Mono">FFL 0</text>
        {earthHatch}

        {/* walls (cut) */}
        <rect x={x0} y={eave} width={wallT} height={eh} fill="#1d2a2a" fillOpacity={0.82}
          data-node-id={`wall-${cut === "cross" ? "W" : "S"}`} data-node-type="Wall" />
        <rect x={x0 + w - wallT} y={eave} width={wallT} height={eh} fill="#1d2a2a" fillOpacity={0.82}
          data-node-id={`wall-${cut === "cross" ? "E" : "N"}`} data-node-type="Wall" />
        <line x1={x0} y1={eave} x2={x0 + w} y2={eave} stroke="#8a7c5e" strokeWidth={1.1} />
        <line x1={x0} y1={eave + 4} x2={x0 + w} y2={eave + 4} stroke="#8a7c5e" strokeWidth={0.7} />

        {/* roof */}
        <polyline points={rpts.map((p) => p.join(",")).join(" ")} fill="#efeadd" stroke="#1d2a2a" strokeWidth={1.2}
          data-node-id="roof" data-node-type="RoofSystem" />
        {ridgeLine && (
          <line x1={x0 - eaveOff} y1={ridgeLine.y} x2={x0 + w + eaveOff} y2={ridgeLine.y}
            stroke="#1d2a2a" strokeWidth={0.9} strokeDasharray="6 3" />
        )}

        {/* truss/rafter representation */}
        {S.roof !== "Flat" && cut === "cross" && S.roof !== "Mono" && (
          <g>
            <line x1={x0} y1={eave} x2={x0 + w} y2={eave} stroke="#8a7c5e" strokeWidth={0.8} strokeDasharray="8 4" />
            <line x1={x0 + w / 2} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke="#8a7c5e" strokeWidth={0.6} />
            <line x1={x0} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke="#8a7c5e" strokeWidth={0.4} />
            <line x1={x0 + w} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke="#8a7c5e" strokeWidth={0.4} />
          </g>
        )}
        {trusses}

        {/* projected openings */}
        {projected.map((o) => {
          const fr = openFrac(S, o);
          const owid = Math.min(o.width, widmm * 0.92) * sc;
          const cxp = x0 + Math.max(owid / 2 + wallT, Math.min(w - owid / 2 - wallT, fr * w));
          const oh = (o.kind === "Window" ? 1000 : (o.kind === "Garage" ? Math.min(S.studH - 200, 2400) : 1980)) * sc;
          const sill = (o.kind === "Window" ? 1000 : 0) * sc;
          return (
            <rect key={o.id} x={cxp - owid / 2} y={base - sill - oh} width={owid} height={oh}
              fill="#fbf9f3" stroke={KIND_COL[o.kind]} strokeWidth={1.2} strokeDasharray="5 3"
              data-node-id={`opening-${o.id}`} data-node-type="Opening" />
          );
        })}

        {/* dimensions */}
        <g>
          <line x1={x0 + w + 24} y1={base} x2={x0 + w + 24} y2={eave} stroke="#7a6f57" strokeWidth={0.5} />
          <line x1={x0 + w + 21} y1={base} x2={x0 + w + 27} y2={base} stroke="#7a6f57" strokeWidth={0.5} />
          <line x1={x0 + w + 21} y1={eave} x2={x0 + w + 27} y2={eave} stroke="#7a6f57" strokeWidth={0.5} />
          <text x={x0 + w + 29} y={(base + eave) / 2} fill="#3c4a47" fontSize={9} fontFamily="IBM Plex Mono">
            {S.studH} stud
          </text>
          {S.roof !== "Flat" && (
            <g>
              <line x1={x0 + w + 24} y1={eave} x2={x0 + w + 24} y2={eave - apexP} stroke="#7a6f57" strokeWidth={0.5} />
              <line x1={x0 + w + 21} y1={eave - apexP} x2={x0 + w + 27} y2={eave - apexP} stroke="#7a6f57" strokeWidth={0.5} />
              <text x={x0 + w + 29} y={(eave + eave - apexP) / 2} fill="#3c4a47" fontSize={9} fontFamily="IBM Plex Mono">
                {Math.round(apexmm)} rise
              </text>
            </g>
          )}
        </g>

        <text x={x0 + w / 2} y={base + (footing * sc) + 22} fill="#3c4a47" fontSize={11}
          fontFamily="IBM Plex Mono" textAnchor="middle">
          SECTION {tag}–{tag} · {cut === "cross" ? "across width" : "along length"} · {S.roof} {S.pitch}°
        </text>
        <SheetFrame />
      </svg>
      <ScaleChip label={`section ${tag}–${tag} · ${cut === "cross" ? "cross (across width)" : "longitudinal (along length)"} · indicative`} />
    </ClickLayer>
  );
}
