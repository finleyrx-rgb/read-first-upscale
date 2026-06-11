import React from "react";
// Framing plan — ported from drawFraming() in public/astral.html.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { type WallKey } from "@/lib/astral/constants";
import { braceLayout, openPlace, planGeom } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";
import { PlanDimensions } from "./PlanDimensions";
import { PlanAnnotations } from "./PlanAnnotations";
import { PartyWalls } from "./PartyWalls";

export function FramingPlan() {
  const S = useAstral(
    useShallow((s) => ({
      L: s.L,
      W: s.W,
      openings: s.openings,
      spacing: s.spacing,
    })),
  );
  const g = planGeom(S);
  const { sc, w, h, x0, y0, tt } = g;
  const spx = S.spacing * sc;

  const studs: number[] = [];
  for (let x = x0 + tt; x <= x0 + w - tt + 0.1; x += spx) studs.push(x);
  const studsY: number[] = [];
  for (let y = y0 + tt; y <= y0 + h - tt + 0.1; y += spx) studsY.push(y);

  const trusses: number[] = [];
  const tspx = 900 * sc;
  for (let x = x0 + tspx; x < x0 + w; x += tspx) trusses.push(x);

  const bandFor: Record<
    WallKey,
    (bp: { start: number; len: number }) => [number, number, number, number]
  > = {
    N: (bp) => [x0 + (bp.start / S.L) * w, y0, (bp.len / S.L) * w, tt],
    S: (bp) => [x0 + (bp.start / S.L) * w, y0 + h - tt, (bp.len / S.L) * w, tt],
    W: (bp) => [x0, y0 + (bp.start / S.W) * h, tt, (bp.len / S.W) * h],
    E: (bp) => [x0 + w - tt, y0 + (bp.start / S.W) * h, tt, (bp.len / S.W) * h],
  };

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        <rect x={x0 + tt} y={y0 + tt} width={w - 2 * tt} height={h - 2 * tt} fill="#f4efe3" />
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          fill="none"
          stroke="#1d2a2a"
          strokeWidth={1.5}
          data-node-id="building"
          data-node-type="Building"
        />
        <rect
          x={x0 + tt}
          y={y0 + tt}
          width={w - 2 * tt}
          height={h - 2 * tt}
          fill="none"
          stroke="#1d2a2a"
          strokeWidth={0.6}
        />

        {studs.map((x, i) => (
          <g key={`sx${i}`}>
            <line x1={x} y1={y0} x2={x} y2={y0 + tt} stroke="#8a7c5e" strokeWidth={0.7} />
            <line x1={x} y1={y0 + h - tt} x2={x} y2={y0 + h} stroke="#8a7c5e" strokeWidth={0.7} />
          </g>
        ))}
        {studsY.map((y, i) => (
          <g key={`sy${i}`}>
            <line x1={x0} y1={y} x2={x0 + tt} y2={y} stroke="#8a7c5e" strokeWidth={0.7} />
            <line x1={x0 + w - tt} y1={y} x2={x0 + w} y2={y} stroke="#8a7c5e" strokeWidth={0.7} />
          </g>
        ))}

        <line
          x1={x0}
          y1={y0 + h / 2}
          x2={x0 + w}
          y2={y0 + h / 2}
          stroke="#bf6b2c"
          strokeWidth={0.8}
          data-node-id="roof"
          data-node-type="RoofSystem"
        />
        {trusses.map((x, i) => (
          <line
            key={`t${i}`}
            x1={x}
            y1={y0}
            x2={x}
            y2={y0 + h}
            stroke="#c8975a"
            strokeWidth={0.6}
            strokeDasharray="3 3"
          />
        ))}

        {[
          [x0, y0],
          [x0 + w, y0],
          [x0, y0 + h],
          [x0 + w, y0 + h],
        ].map(([cx, cy], i) => (
          <rect
            key={`cnr${i}`}
            x={cx - tt / 2}
            y={cy - tt / 2}
            width={tt}
            height={tt}
            fill="#1d2a2a"
            opacity={0.55}
          />
        ))}

        {S.openings.map((o) => {
          const pl = openPlace(S, o, g);
          if (pl.horiz) {
            const ax = Math.max(x0, Math.min(x0 + w - pl.owid, pl.cx - pl.owid / 2));
            const yb = pl.cy < y0 + h / 2 ? y0 : y0 + h - tt;
            return (
              <g key={o.id}>
                <rect
                  x={ax}
                  y={yb}
                  width={pl.owid}
                  height={tt}
                  fill="#f0e3cf"
                  stroke="#b4472d"
                  strokeWidth={1.2}
                  data-node-id={`opening-${o.id}`}
                  data-node-type="Opening"
                />
                {[ax, ax + pl.owid].map((jx, i) => (
                  <rect
                    key={i}
                    x={jx - 1.5}
                    y={yb}
                    width={3}
                    height={tt}
                    fill="#1d2a2a"
                    opacity={0.6}
                  />
                ))}
              </g>
            );
          }
          const ay = Math.max(y0, Math.min(y0 + h - pl.owid, pl.cy - pl.owid / 2));
          const xb = pl.cx < x0 + w / 2 ? x0 : x0 + w - tt;
          return (
            <g key={o.id}>
              <rect
                x={xb}
                y={ay}
                width={tt}
                height={pl.owid}
                fill="#f0e3cf"
                stroke="#b4472d"
                strokeWidth={1.2}
                data-node-id={`opening-${o.id}`}
                data-node-type="Opening"
              />
              {[ay, ay + pl.owid].map((jy, i) => (
                <rect
                  key={i}
                  x={xb}
                  y={jy - 1.5}
                  width={tt}
                  height={3}
                  fill="#1d2a2a"
                  opacity={0.6}
                />
              ))}
            </g>
          );
        })}

        {(["N", "S", "E", "W"] as WallKey[]).flatMap((wll) =>
          braceLayout(S, wll).map((bp, i) => {
            const [bx, by, bw, bh] = bandFor[wll](bp);
            return (
              <g key={`${wll}${i}`}>
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  fill="rgba(63,125,84,0.16)"
                  stroke="#3f7d54"
                  strokeWidth={0.8}
                />
                <line
                  x1={bx}
                  y1={by}
                  x2={bx + bw}
                  y2={by + bh}
                  stroke="#3f7d54"
                  strokeWidth={0.6}
                />
                <line
                  x1={bx + bw}
                  y1={by}
                  x2={bx}
                  y2={by + bh}
                  stroke="#3f7d54"
                  strokeWidth={0.6}
                />
              </g>
            );
          }),
        )}

        <text
          x={x0 + w / 2}
          y={y0 - 26}
          fill="#3c4a47"
          fontSize={10}
          fontFamily="IBM Plex Mono"
          textAnchor="middle"
        >
          FRAMING PLAN — studs · trusses @900 · lintels (red) · bracing (green)
        </text>
        <text
          x={x0 + w / 2}
          y={y0 - 14}
          fill="#3f7d54"
          fontSize={8}
          fontFamily="IBM Plex Mono"
          textAnchor="middle"
        >
          bracing panels indicative — confirm BU demand &amp; layout
        </text>
        <PartyWalls />
        <PlanDimensions />
        <PlanAnnotations />
        <SheetFrame />
      </svg>
      <ScaleChip label={`framing plan · studs @${S.spacing} · trusses @900`} />
    </ClickLayer>
  );
}
