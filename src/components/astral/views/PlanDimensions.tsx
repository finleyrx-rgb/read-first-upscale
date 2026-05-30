// Tiered dimension strings for the architectural plan.
// Ported from dimPlan() in public/astral.html.
// Rows: WINDOWS · INTERIOR WALLS · OVERALL — top / bottom / left / right.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { planGeom } from "@/lib/astral/geom";
import type { WallKey } from "@/lib/astral/constants";

const INK = "#1d2a2a";
const LAB = "#9a8f78";
const MONO = "IBM Plex Mono";

function dedup(arr: number[]) {
  return [...new Set(arr.map((n) => Math.round(n)))].sort((a, b) => a - b);
}

export function PlanDimensions() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, openings: s.openings, parts: s.parts, unit: s.unit,
  })));
  const { sc, w, h, x0, y0 } = planGeom(S);
  const fmt = (mm: number) => (S.unit === "m" ? (mm / 1000).toFixed(2) : `${Math.round(mm)}`);

  const opsAt = (wl: WallKey) =>
    S.openings.filter((o) => o.wall === wl).map((o) => o.off).sort((a, b) => a - b);
  const nOps = opsAt("N");
  const sOps = opsAt("S");
  const wOps = opsAt("W");
  const eOps = opsAt("E");
  const partsAcrossX = S.parts.filter((p) => p.dir === "Across width").map((p) => p.off).sort((a, b) => a - b);
  const partsAlongY = S.parts.filter((p) => p.dir === "Along length").map((p) => p.off).sort((a, b) => a - b);

  // Horizontal row at y; ptsMM are along L
  const rowH = (ptsMM: number[], y: number, name: string, key: string) => {
    if (ptsMM.length < 2) return null;
    const xs = ptsMM.map((mm) => x0 + mm * sc);
    return (
      <g key={key}>
        <line x1={xs[0]} y1={y} x2={xs[xs.length - 1]} y2={y} stroke={INK} strokeWidth={0.5} />
        {xs.map((x, i) => (
          <line key={i} x1={x} y1={y - 3} x2={x} y2={y + 3} stroke={INK} strokeWidth={0.5} />
        ))}
        {xs.slice(1).map((x, i) => {
          const prev = xs[i];
          const seg = ptsMM[i + 1] - ptsMM[i];
          if (x - prev <= 14) return null;
          return (
            <text key={`t${i}`} x={(prev + x) / 2} y={y - 3} fill={INK} fontSize={7.5}
              fontFamily={MONO} textAnchor="middle">{fmt(seg)}</text>
          );
        })}
        <text x={xs[xs.length - 1] + 6} y={y + 2.5} fill={LAB} fontSize={6.5}
          fontFamily={MONO} textAnchor="start">{name}</text>
      </g>
    );
  };

  // Vertical row at x; ptsMM are along W
  const rowV = (ptsMM: number[], x: number, name: string, key: string) => {
    if (ptsMM.length < 2) return null;
    const ys = ptsMM.map((mm) => y0 + mm * sc);
    return (
      <g key={key}>
        <line x1={x} y1={ys[0]} x2={x} y2={ys[ys.length - 1]} stroke={INK} strokeWidth={0.5} />
        {ys.map((y, i) => (
          <line key={i} x1={x - 3} y1={y} x2={x + 3} y2={y} stroke={INK} strokeWidth={0.5} />
        ))}
        {ys.slice(1).map((y, i) => {
          const prev = ys[i];
          const seg = ptsMM[i + 1] - ptsMM[i];
          if (y - prev <= 14) return null;
          const my = (prev + y) / 2;
          return (
            <text key={`t${i}`} x={x - 3} y={my} fill={INK} fontSize={7.5}
              fontFamily={MONO} textAnchor="middle" transform={`rotate(-90 ${x - 3} ${my})`}>{fmt(seg)}</text>
          );
        })}
        <text x={x} y={ys[ys.length - 1] + 10} fill={LAB} fontSize={6.5}
          fontFamily={MONO} textAnchor="middle">{name}</text>
      </g>
    );
  };

  const out: React.ReactNode[] = [];
  // TOP
  if (nOps.length) out.push(rowH(dedup([0, ...nOps, S.L]), y0 - 22, "WINDOWS", "n-win"));
  out.push(rowH([0, S.L], y0 - (nOps.length ? 40 : 22), "OVERALL", "n-ov"));
  // BOTTOM
  let bRow = y0 + h + 22;
  if (sOps.length) { out.push(rowH(dedup([0, ...sOps, S.L]), bRow, "WINDOWS", "s-win")); bRow += 18; }
  if (partsAcrossX.length) { out.push(rowH(dedup([0, ...partsAcrossX, S.L]), bRow, "INTERIOR WALLS", "s-int")); bRow += 18; }
  out.push(rowH([0, S.L], bRow, "OVERALL", "s-ov"));
  // LEFT
  let lCol = x0 - 22;
  if (wOps.length) { out.push(rowV(dedup([0, ...wOps, S.W]), lCol, "WINDOWS", "w-win")); lCol -= 18; }
  if (partsAlongY.length) { out.push(rowV(dedup([0, ...partsAlongY, S.W]), lCol, "INTERIOR WALLS", "w-int")); lCol -= 18; }
  out.push(rowV([0, S.W], lCol, "OVERALL", "w-ov"));
  // RIGHT
  let rCol = x0 + w + 22;
  if (eOps.length) { out.push(rowV(dedup([0, ...eOps, S.W]), rCol, "WINDOWS", "e-win")); rCol += 18; }
  out.push(rowV([0, S.W], rCol, "OVERALL", "e-ov"));

  return <g pointerEvents="none">{out}</g>;
}
