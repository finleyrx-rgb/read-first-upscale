import React from "react";
// Foundation plan — ported from drawFoundation() in public/astral.html and
// extended (§7.3 "concrete to detail level"): control joints, mesh-direction
// symbol, DPM extent, pad footings under load points, thickened-edge band,
// reinforcement legend, dim chain on thickening.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { openPlace, planGeom } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";
import { PlanDimensions } from "./PlanDimensions";
import { PlanAnnotations } from "./PlanAnnotations";
import { PartyWalls } from "./PartyWalls";

const INK = "#1d2a2a";
const MONO = "IBM Plex Mono";
const REBAR = "#2f6f7e";
const DPM = "#bf6b2c";
const HATCH = "#8a7c5e";

export function FoundationPlan() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, openings: s.openings, units: s.units, found: s.found,
  })));
  const g = planGeom(S);
  const { sc, w, h, x0, y0 } = g;
  const edgeMM = 300;          // thickened edge width
  const ed = edgeMM * sc;
  const garages = S.openings.filter((o) => o.kind === "Garage");
  const piles = S.found !== "Concrete slab";

  // mesh sheet grid — SE82 sheets are 6.0×2.4 m, indicate seams every 2400/6000mm
  const meshX: number[] = [];
  for (let x = x0 + 2400 * sc; x < x0 + w; x += 2400 * sc) meshX.push(x);
  const meshY: number[] = [];
  for (let y = y0 + 2400 * sc; y < y0 + h; y += 2400 * sc) meshY.push(y);

  // control / saw-cut joints — at ~1/3 spans, aim for max ~6m bays
  const cjX: number[] = [];
  const cjCount = Math.max(0, Math.floor(S.L / 6) - 1);
  for (let i = 1; i <= cjCount; i++) cjX.push(x0 + (i / (cjCount + 1)) * w);
  const cjY: number[] = [];
  const cjCountY = Math.max(0, Math.floor(S.W / 6) - 1);
  for (let i = 1; i <= cjCountY; i++) cjY.push(y0 + (i / (cjCountY + 1)) * h);

  // pad footings — corners + along long walls every ~3m + at party walls
  const padPositions: Array<[number, number]> = [];
  [y0, y0 + h].forEach((py) => {
    const step = w / Math.max(2, Math.round(S.L / 3));
    for (let i = 0; i <= Math.round(S.L / 3); i++) padPositions.push([x0 + i * step, py]);
  });
  if (S.units > 1) {
    for (let u = 1; u < S.units; u++) {
      const px = x0 + (u / S.units) * w;
      padPositions.push([px, y0], [px, y0 + h]);
    }
  }

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        {/* slab outline */}
        <rect x={x0} y={y0} width={w} height={h} fill="#efeadd" stroke={INK} strokeWidth={1.5}
          data-node-id="slab" data-node-type="Slab" />

        {/* DPM extent — extends 50mm past slab edge */}
        <rect x={x0 - 4} y={y0 - 4} width={w + 8} height={h + 8}
          fill="none" stroke={DPM} strokeWidth={0.6} strokeDasharray="2 2" pointerEvents="none" />

        {/* thickened edge band */}
        <rect x={x0 + ed} y={y0 + ed} width={w - 2 * ed} height={h - 2 * ed}
          fill="none" stroke={HATCH} strokeWidth={0.7} strokeDasharray="5 3" />
        {/* edge-band 45° hatch (between outer edge and inner thickening line) */}
        <ThickeningHatch x={x0} y={y0} w={w} h={h} ed={ed} />

        {/* mesh sheet seams — light cross-hatch */}
        {meshX.map((x) => (
          <line key={`mx${x}`} x1={x} y1={y0 + 4} x2={x} y2={y0 + h - 4}
            stroke={REBAR} strokeWidth={0.35} strokeDasharray="1 3" pointerEvents="none" />
        ))}
        {meshY.map((y) => (
          <line key={`my${y}`} x1={x0 + 4} y1={y} x2={x0 + w - 4} y2={y}
            stroke={REBAR} strokeWidth={0.35} strokeDasharray="1 3" pointerEvents="none" />
        ))}

        {/* control / saw-cut joints — bold dashed across slab */}
        {cjX.map((x) => (
          <g key={`cjx${x}`} pointerEvents="none">
            <line x1={x} y1={y0 + ed} x2={x} y2={y0 + h - ed}
              stroke={INK} strokeWidth={0.9} strokeDasharray="8 4" />
            <text x={x} y={y0 + ed - 3} fill={INK} fontSize={6.5} fontFamily={MONO} textAnchor="middle">CJ</text>
          </g>
        ))}
        {cjY.map((y) => (
          <g key={`cjy${y}`} pointerEvents="none">
            <line x1={x0 + ed} y1={y} x2={x0 + w - ed} y2={y}
              stroke={INK} strokeWidth={0.9} strokeDasharray="8 4" />
            <text x={x0 + ed - 3} y={y - 3} fill={INK} fontSize={6.5} fontFamily={MONO} textAnchor="end">CJ</text>
          </g>
        ))}

        {/* pad footings */}
        {padPositions.map(([px, py], i) => (
          <g key={`pad${i}`} pointerEvents="none">
            <rect x={px - 6} y={py - 6} width={12} height={12} fill="#efeadd" stroke={INK} strokeWidth={0.9} />
            <line x1={px - 6} y1={py - 6} x2={px + 6} y2={py + 6} stroke={INK} strokeWidth={0.4} />
            <line x1={px + 6} y1={py - 6} x2={px - 6} y2={py + 6} stroke={INK} strokeWidth={0.4} />
          </g>
        ))}

        {/* garage rebates — already in spec */}
        {garages.map((o) => {
          const pl = openPlace(S, o, g);
          const pts = pl.horiz
            ? [pl.cx - pl.owid / 2, pl.cx + pl.owid / 2].map((xx) => ({ x: xx - 3, y: pl.cy - 3 }))
            : [pl.cy - pl.owid / 2, pl.cy + pl.owid / 2].map((yy) => ({ x: pl.cx - 3, y: yy - 3 }));
          return pts.map((p, i) => (
            <rect key={`${o.id}-${i}`} x={p.x} y={p.y} width={7} height={7}
              fill="none" stroke={DPM} strokeWidth={0.9}
              data-node-id={`opening-${o.id}`} data-node-type="Opening" />
          ));
        })}

        {/* thickened-edge dim chain — top edge, outside slab */}
        <g pointerEvents="none">
          <line x1={x0} y1={y0 - 22} x2={x0 + ed} y2={y0 - 22} stroke={INK} strokeWidth={0.5} />
          <line x1={x0} y1={y0 - 26} x2={x0} y2={y0 - 18} stroke={INK} strokeWidth={0.5} />
          <line x1={x0 + ed} y1={y0 - 26} x2={x0 + ed} y2={y0 - 18} stroke={INK} strokeWidth={0.5} />
          <text x={x0 + ed / 2} y={y0 - 26} fill={INK} fontSize={7} fontFamily={MONO} textAnchor="middle">{edgeMM}</text>
        </g>

        {/* mesh-direction symbol — top-right corner */}
        <g transform={`translate(${x0 + w - 60} ${y0 + 14})`} pointerEvents="none">
          <rect x={-4} y={-9} width={56} height={18} fill="#fbf9f3" stroke={HATCH} strokeWidth={0.5} />
          <line x1={0} y1={-4} x2={48} y2={-4} stroke={REBAR} strokeWidth={0.5} />
          <line x1={0} y1={0} x2={48} y2={0} stroke={REBAR} strokeWidth={0.5} />
          <line x1={0} y1={4} x2={48} y2={4} stroke={REBAR} strokeWidth={0.5} />
          <text x={24} y={-5} fill={INK} fontSize={6.5} fontFamily={MONO} textAnchor="middle">SE82</text>
        </g>

        {piles && (
          <text x={x0 + w / 2} y={y0 + h / 2 - 14} fill="#b4472d" fontSize={9} fontFamily={MONO} textAnchor="middle">
            TIMBER PILE FOUNDATION — pad symbols indicate pile locations
          </text>
        )}
        <text x={x0 + w / 2} y={y0 + h / 2} fill="#7a6f57" fontSize={9} fontFamily={MONO} textAnchor="middle">
          100 SLAB · SE82 MESH · 0.25 DPM · 300 THICKENED EDGE (SED)
        </text>
        <text x={x0 + w / 2} y={y0 + h / 2 + 12} fill="#7a6f57" fontSize={8} fontFamily={MONO} textAnchor="middle">
          CJ = control / saw-cut joint · pad symbols = footings / pile heads
        </text>
        <text x={x0 + w / 2} y={y0 - 16} fill="#3c4a47" fontSize={10} fontFamily={MONO} textAnchor="middle">
          FOUNDATION — slab, thickened edge, bearing pads
        </text>

        <PartyWalls />
        <PlanDimensions />
        <PlanAnnotations />
        <SheetFrame />
      </svg>
      <ScaleChip label="foundation / slab plan · concrete to detail level" />
    </ClickLayer>
  );
}

function ThickeningHatch({ x, y, w, h, ed }: { x: number; y: number; w: number; h: number; ed: number }) {
  // 45° hatch limited to edge band — drawn as four trapezoidal strips by clipPath
  const id = "edgeBandClip";
  const lines: React.ReactElement[] = [];
  for (let s = -h; s < w + h; s += 10) {
    lines.push(<line key={s} x1={x + s} y1={y} x2={x + s + h} y2={y + h}
      stroke={HATCH} strokeWidth={0.35} opacity={0.55} />);
  }
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={id}>
          <path d={`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z
                    M ${x + ed} ${y + ed} L ${x + ed} ${y + h - ed} L ${x + w - ed} ${y + h - ed} L ${x + w - ed} ${y + ed} Z`}
            fillRule="evenodd" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{lines}</g>
    </g>
  );
}
