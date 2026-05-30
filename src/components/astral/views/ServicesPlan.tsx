// Services plan — §7.5 services layer: power, plumbing, drainage.
// Symbols follow NZ builder/sparky conventions: filled circle = double GPO,
// "S" in square = switch, sun-glyph = light, ⊕ = downlight, HWC = hot-water
// cylinder, DB = distribution board, GT = gully trap. Hot/cold/waste/drain
// lines colour-coded.

import React, { useMemo } from "react";
import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { planGeom, openPlace } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";
import { PlanDimensions } from "./PlanDimensions";
import { PlanAnnotations } from "./PlanAnnotations";
import { PartyWalls } from "./PartyWalls";

const INK = "#1d2a2a";
const MONO = "IBM Plex Mono";
const COLD = "#2f6f7e";
const HOT = "#b4472d";
const WASTE = "#7a6f57";
const DRAIN = "#3f7d54";
const POWER = "#3c4a47";
const SWITCH = "#bf6b2c";

type Pt = { x: number; y: number };

function buildServices(
  S: { L: number; W: number; openings: ReturnType<typeof useAstral.getState>["openings"]; type: string; units: number },
  g: ReturnType<typeof planGeom>,
) {
  const { x0, y0, w, h, sc } = g;
  const inset = 200 * sc; // bring fittings inside the wall

  // Doors give us natural entry / switch locations.
  const doors = S.openings.filter((o) => o.kind === "Door");
  // Distribute lights as a grid — 1 per ~12 m² floor area
  const floorA = (S.L * S.W) / 1_000_000;
  const lightCount = Math.max(1, Math.round(floorA / 12));
  const cols = Math.max(1, Math.round(Math.sqrt(lightCount * (S.L / S.W))));
  const rows = Math.max(1, Math.ceil(lightCount / cols));
  const lights: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      lights.push({
        x: x0 + ((c + 0.5) / cols) * w,
        y: y0 + ((r + 0.5) / rows) * h,
      });
    }
  }

  // Sockets along interior perimeter — every ~3.5m, inset from each wall
  const socketStep = 3500 * sc;
  const sockets: Array<Pt & { wall: "N" | "S" | "E" | "W" }> = [];
  // N + S walls
  for (let x = x0 + socketStep / 2; x < x0 + w; x += socketStep) {
    sockets.push({ x, y: y0 + inset, wall: "N" });
    sockets.push({ x, y: y0 + h - inset, wall: "S" });
  }
  // W + E walls (skip if too narrow)
  if (h > 4 * inset) {
    for (let y = y0 + socketStep / 2; y < y0 + h; y += socketStep) {
      sockets.push({ x: x0 + inset, y, wall: "W" });
      sockets.push({ x: x0 + w - inset, y, wall: "E" });
    }
  }

  // Switches at the interior side of each door
  const switches: Pt[] = doors.map((o) => {
    const pl = openPlace(S, o, g);
    const dx = o.wall === "W" ? inset * 1.6 : o.wall === "E" ? -inset * 1.6 : 0;
    const dy = o.wall === "N" ? inset * 1.6 : o.wall === "S" ? -inset * 1.6 : 0;
    return { x: pl.cx + dx, y: pl.cy + dy };
  });

  // Distribution board — near the most "front" door, on interior face
  const frontDoor = doors.find((o) => o.wall === "S") || doors[0];
  const db = frontDoor
    ? (() => {
        const pl = openPlace(S, frontDoor, g);
        return { x: pl.cx + (frontDoor.wall === "S" ? -inset * 0.6 : 0), y: pl.cy - inset * 0.7 };
      })()
    : { x: x0 + inset, y: y0 + inset };

  // Plumbing only if not a bare garage (or units > 1)
  const wet = S.type !== "Garage" || S.units > 1;
  const hwc: Pt | null = wet ? { x: x0 + w - inset * 1.4, y: y0 + inset * 1.2 } : null;
  const sink: Pt | null = wet ? { x: x0 + w - inset * 1.4, y: y0 + h / 2 } : null;
  const wc: Pt | null = wet ? { x: x0 + w - inset * 2.4, y: y0 + h - inset * 1.4 } : null;
  const basin: Pt | null = wet ? { x: x0 + w - inset * 1.4, y: y0 + h - inset * 1.4 } : null;

  // Drainage: gully trap outside the wet wall, soil pipe to the boundary edge
  const gt: Pt | null = wet ? { x: x0 + w + inset * 0.4, y: y0 + h - inset * 1.4 } : null;

  return { lights, sockets, switches, db, hwc, sink, wc, basin, gt, wet };
}

export function ServicesPlan() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, openings: s.openings, type: s.type, units: s.units,
  })));
  const g = planGeom(S);
  const { x0, y0, w, h } = g;
  const svc = useMemo(() => buildServices(S, g), [S, g]);

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        {/* base outline (light) */}
        <rect x={x0} y={y0} width={w} height={h} fill="#fbf9f3" stroke={INK} strokeWidth={1.4}
          data-node-id="building" data-node-type="Building" />

        {/* plumbing runs — drawn under symbols */}
        {svc.wet && svc.hwc && svc.sink && svc.basin && svc.wc && (
          <g pointerEvents="none">
            {/* cold feed: HWC → sink → basin → wc */}
            <polyline
              points={[svc.hwc, svc.sink, svc.basin, svc.wc].map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={COLD} strokeWidth={1.1} />
            {/* hot run: HWC → sink → basin */}
            <polyline
              points={[svc.hwc, { x: svc.sink.x - 6, y: svc.sink.y }, { x: svc.basin.x - 6, y: svc.basin.y }].map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={HOT} strokeWidth={1.1} />
            {/* waste: sink + basin + wc → gully trap */}
            {svc.gt && (
              <>
                <polyline points={[svc.sink, { x: svc.sink.x + 8, y: svc.sink.y }, svc.gt].map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={WASTE} strokeWidth={1} strokeDasharray="3 2" />
                <polyline points={[svc.basin, { x: svc.basin.x + 8, y: svc.basin.y }, svc.gt].map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={WASTE} strokeWidth={1} strokeDasharray="3 2" />
                {/* soil pipe DN100 wc → drain */}
                <line x1={svc.wc.x} y1={svc.wc.y} x2={x0 + w + 40} y2={svc.wc.y}
                  stroke={DRAIN} strokeWidth={1.6} />
                <text x={x0 + w + 42} y={svc.wc.y + 3} fill={DRAIN} fontSize={8} fontFamily={MONO}>DN100 SOIL</text>
                {/* gully drain to boundary */}
                <line x1={svc.gt.x} y1={svc.gt.y} x2={x0 + w + 40} y2={svc.gt.y + 18}
                  stroke={DRAIN} strokeWidth={1.2} strokeDasharray="6 2" />
              </>
            )}
          </g>
        )}

        {/* power runs — sockets to DB (lightly), lights tied to switches */}
        <g pointerEvents="none">
          {svc.sockets.map((s, i) => (
            <line key={`pwr${i}`} x1={s.x} y1={s.y} x2={svc.db.x} y2={svc.db.y}
              stroke={POWER} strokeWidth={0.35} opacity={0.35} strokeDasharray="2 3" />
          ))}
          {svc.switches.map((s, i) => {
            const l = svc.lights[i % svc.lights.length];
            return (
              <line key={`sw${i}`} x1={s.x} y1={s.y} x2={l.x} y2={l.y}
                stroke={SWITCH} strokeWidth={0.5} opacity={0.55} strokeDasharray="4 2" />
            );
          })}
        </g>

        {/* lights */}
        {svc.lights.map((l, i) => (
          <g key={`l${i}`} pointerEvents="none">
            <circle cx={l.x} cy={l.y} r={5} fill="#fbf9f3" stroke={INK} strokeWidth={0.8} />
            <line x1={l.x - 7} y1={l.y} x2={l.x + 7} y2={l.y} stroke={INK} strokeWidth={0.5} />
            <line x1={l.x} y1={l.y - 7} x2={l.x} y2={l.y + 7} stroke={INK} strokeWidth={0.5} />
            <line x1={l.x - 5} y1={l.y - 5} x2={l.x + 5} y2={l.y + 5} stroke={INK} strokeWidth={0.4} />
            <line x1={l.x + 5} y1={l.y - 5} x2={l.x - 5} y2={l.y + 5} stroke={INK} strokeWidth={0.4} />
          </g>
        ))}

        {/* sockets — filled circle with two prongs (NZ double GPO) */}
        {svc.sockets.map((s, i) => (
          <g key={`s${i}`} pointerEvents="none">
            <circle cx={s.x} cy={s.y} r={4} fill={POWER} stroke={INK} strokeWidth={0.5} />
            <line x1={s.x - 2.5} y1={s.y + 6} x2={s.x - 2.5} y2={s.y + 9}
              stroke={POWER} strokeWidth={0.8} />
            <line x1={s.x + 2.5} y1={s.y + 6} x2={s.x + 2.5} y2={s.y + 9}
              stroke={POWER} strokeWidth={0.8} />
          </g>
        ))}

        {/* switches */}
        {svc.switches.map((s, i) => (
          <g key={`sw${i}`} pointerEvents="none">
            <rect x={s.x - 5} y={s.y - 5} width={10} height={10} fill="#fbf9f3" stroke={SWITCH} strokeWidth={0.8} />
            <text x={s.x} y={s.y + 3} fill={SWITCH} fontSize={8} fontFamily={MONO} textAnchor="middle" fontWeight={600}>S</text>
          </g>
        ))}

        {/* distribution board */}
        <g pointerEvents="none">
          <rect x={svc.db.x - 11} y={svc.db.y - 7} width={22} height={14}
            fill="#fbf9f3" stroke={INK} strokeWidth={1} />
          <text x={svc.db.x} y={svc.db.y + 3} fill={INK} fontSize={8} fontFamily={MONO}
            textAnchor="middle" fontWeight={700}>DB</text>
        </g>

        {/* plumbing fixtures */}
        {svc.hwc && (
          <g pointerEvents="none">
            <rect x={svc.hwc.x - 10} y={svc.hwc.y - 10} width={20} height={20}
              fill="#fbf9f3" stroke={HOT} strokeWidth={1} />
            <text x={svc.hwc.x} y={svc.hwc.y + 3} fill={HOT} fontSize={8} fontFamily={MONO} textAnchor="middle" fontWeight={700}>HWC</text>
          </g>
        )}
        {svc.sink && (
          <g pointerEvents="none">
            <rect x={svc.sink.x - 12} y={svc.sink.y - 7} width={24} height={14}
              fill="#fbf9f3" stroke={COLD} strokeWidth={0.9} />
            <line x1={svc.sink.x - 12} y1={svc.sink.y} x2={svc.sink.x + 12} y2={svc.sink.y}
              stroke={COLD} strokeWidth={0.5} />
            <circle cx={svc.sink.x - 4} cy={svc.sink.y - 4} r={1.2} fill={COLD} />
          </g>
        )}
        {svc.basin && (
          <g pointerEvents="none">
            <rect x={svc.basin.x - 7} y={svc.basin.y - 6} width={14} height={12}
              fill="#fbf9f3" stroke={COLD} strokeWidth={0.8} rx={2} />
            <circle cx={svc.basin.x} cy={svc.basin.y} r={1.4} fill={COLD} />
          </g>
        )}
        {svc.wc && (
          <g pointerEvents="none">
            <rect x={svc.wc.x - 6} y={svc.wc.y - 9} width={12} height={6} fill="#fbf9f3" stroke={INK} strokeWidth={0.7} />
            <ellipse cx={svc.wc.x} cy={svc.wc.y + 2} rx={6} ry={5} fill="#fbf9f3" stroke={INK} strokeWidth={0.7} />
            <text x={svc.wc.x} y={svc.wc.y + 3.5} fill={INK} fontSize={6} fontFamily={MONO} textAnchor="middle">WC</text>
          </g>
        )}
        {svc.gt && (
          <g pointerEvents="none">
            <circle cx={svc.gt.x} cy={svc.gt.y} r={6} fill="#fbf9f3" stroke={DRAIN} strokeWidth={1} />
            <text x={svc.gt.x} y={svc.gt.y + 2.5} fill={DRAIN} fontSize={7} fontFamily={MONO} textAnchor="middle" fontWeight={700}>GT</text>
          </g>
        )}

        {/* legend */}
        <ServicesLegend />

        <text x={x0 + w / 2} y={y0 - 16} fill="#3c4a47" fontSize={10} fontFamily={MONO} textAnchor="middle">
          SERVICES — power · plumbing · drainage (indicative · confirm sparky / plumber)
        </text>

        <PartyWalls />
        <PlanDimensions />
        <PlanAnnotations />
        <SheetFrame />
      </svg>
      <ScaleChip label="services plan · power / plumbing / drainage · indicative" />
    </ClickLayer>
  );
}

function ServicesLegend() {
  const items: Array<[string, string, "line" | "dash" | "swatch", string]> = [
    ["GPO double socket", POWER, "swatch", "●"],
    ["Light fitting", INK, "swatch", "✦"],
    ["Switch", SWITCH, "swatch", "S"],
    ["DB · distribution board", INK, "swatch", "▢"],
    ["Cold water", COLD, "line", ""],
    ["Hot water", HOT, "line", ""],
    ["Waste", WASTE, "dash", ""],
    ["Drainage DN100", DRAIN, "line", ""],
  ];
  const bx = 16, by = 78, rh = 13;
  return (
    <g pointerEvents="none">
      <rect x={bx - 4} y={by - 12} width={150} height={items.length * rh + 10}
        fill="#fbf9f3" stroke="#cfc6b4" strokeWidth={0.7} rx={3} opacity={0.96} />
      <text x={bx} y={by - 2} fill="#3c4a47" fontSize={7.5} fontFamily={MONO} letterSpacing="0.1em">SERVICES KEY</text>
      {items.map(([lab, col, kind, glyph], i) => {
        const yy = by + 9 + i * rh;
        return (
          <g key={lab}>
            {kind === "line" ? (
              <line x1={bx} y1={yy - 2} x2={bx + 16} y2={yy - 2} stroke={col} strokeWidth={1.2} />
            ) : kind === "dash" ? (
              <line x1={bx} y1={yy - 2} x2={bx + 16} y2={yy - 2} stroke={col} strokeWidth={1.2} strokeDasharray="3 2" />
            ) : (
              <text x={bx + 8} y={yy} fill={col} fontSize={9} fontFamily={MONO} textAnchor="middle" fontWeight={600}>{glyph}</text>
            )}
            <text x={bx + 22} y={yy} fill={INK} fontSize={8.5} fontFamily={MONO}>{lab}</text>
          </g>
        );
      })}
    </g>
  );
}
