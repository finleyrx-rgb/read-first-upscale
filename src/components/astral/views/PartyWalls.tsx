// Party walls + unit labels for multi-unit (duplex/triplex) plans.
// Reused by PlanView, FramingPlan, FoundationPlan.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { planGeom } from "@/lib/astral/geom";

const LETTERS = ["A", "B", "C"];

export function PartyWalls() {
  const S = useAstral(useShallow((s) => ({ L: s.L, W: s.W, units: s.units })));
  if (!S.units || S.units < 2) return null;
  const { w, h, x0, y0 } = planGeom(S);
  const lines: number[] = [];
  for (let i = 1; i < S.units; i++) lines.push(x0 + (i / S.units) * w);
  const cellW = w / S.units;
  return (
    <g>
      {lines.map((x, i) => (
        <line
          key={`pw${i}`}
          x1={x}
          y1={y0}
          x2={x}
          y2={y0 + h}
          stroke="#7a4a16"
          strokeWidth={1.4}
          strokeDasharray="6 3"
          data-node-id={`partywall-${i}`}
          data-node-type="Wall"
        />
      ))}
      {Array.from({ length: S.units }).map((_, i) => (
        <text
          key={`ul${i}`}
          x={x0 + cellW * (i + 0.5)}
          y={y0 + h / 2}
          fill="#7a4a16"
          fontSize={14}
          fontFamily="IBM Plex Mono"
          fontWeight={600}
          textAnchor="middle"
          opacity={0.55}
          pointerEvents="none"
        >
          {`Unit ${LETTERS[i] ?? i + 1}`}
        </text>
      ))}
    </g>
  );
}
