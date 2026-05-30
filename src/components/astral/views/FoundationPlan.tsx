import React from "react";
// Foundation plan — ported from drawFoundation() in public/astral.html.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { openPlace, planGeom } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";
import { PlanDimensions } from "./PlanDimensions";
import { PlanAnnotations } from "./PlanAnnotations";
import { PartyWalls } from "./PartyWalls";

export function FoundationPlan() {
  const S = useAstral(useShallow((s) => ({ L: s.L, W: s.W, openings: s.openings })));
  const g = planGeom(S);
  const { sc, w, h, x0, y0 } = g;
  const ed = 300 * sc;
  const garages = S.openings.filter((o) => o.kind === "Garage");

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        <rect x={x0} y={y0} width={w} height={h} fill="#efeadd" stroke="#1d2a2a" strokeWidth={1.5}
          data-node-id="slab" data-node-type="Slab" />
        <rect x={x0 + ed} y={y0 + ed} width={w - 2 * ed} height={h - 2 * ed}
          fill="none" stroke="#8a7c5e" strokeWidth={0.7} strokeDasharray="5 3" />

        {[0.33, 0.66].flatMap((fx) => [y0, y0 + h].map((py, i) => (
          <g key={`${fx}-${i}`}>
            <rect x={x0 + fx * w - 4} y={py - 4} width={8} height={8} fill="none" stroke="#1d2a2a" strokeWidth={0.8} />
            <line x1={x0 + fx * w - 4} y1={py - 4} x2={x0 + fx * w + 4} y2={py + 4} stroke="#1d2a2a" strokeWidth={0.4} />
          </g>
        )))}

        {garages.map((o) => {
          const pl = openPlace(S, o, g);
          const pts = pl.horiz
            ? [pl.cx - pl.owid / 2, pl.cx + pl.owid / 2].map((xx) => ({ x: xx - 3, y: pl.cy - 3 }))
            : [pl.cy - pl.owid / 2, pl.cy + pl.owid / 2].map((yy) => ({ x: pl.cx - 3, y: yy - 3 }));
          return pts.map((p, i) => (
            <rect key={`${o.id}-${i}`} x={p.x} y={p.y} width={7} height={7}
              fill="none" stroke="#bf6b2c" strokeWidth={0.9}
              data-node-id={`opening-${o.id}`} data-node-type="Opening" />
          ));
        })}

        <text x={x0 + w / 2} y={y0 + h / 2} fill="#7a6f57" fontSize={9} fontFamily="IBM Plex Mono" textAnchor="middle">
          100 SLAB · SE82 MESH · DPM · 300 THICKENED EDGE (SED)
        </text>
        <text x={x0 + w / 2} y={y0 - 16} fill="#3c4a47" fontSize={10} fontFamily="IBM Plex Mono" textAnchor="middle">
          FOUNDATION — slab, thickened edge, bearing pads
        </text>
        <PartyWalls />
        <PlanDimensions />
        <PlanAnnotations />
        <SheetFrame />
      </svg>
      <ScaleChip label="foundation / slab plan" />
    </ClickLayer>
  );
}
