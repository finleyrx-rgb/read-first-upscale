// Plan — architectural layer. Ported from drawPlan() in public/astral.html.

import { useAstral, overlappingOpeningIds } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { WALLNAME, type WallKey } from "@/lib/astral/constants";
import { KIND_COL, cladHex, openPlace, planGeom, wallLen } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { SheetFrame } from "../SheetFrame";
import { PlanDimensions } from "./PlanDimensions";
import { PlanAnnotations } from "./PlanAnnotations";
import { PartyWalls } from "./PartyWalls";
import { WallLegend, WallStrips } from "./WallLegend";

export function PlanView() {
  const S = useAstral(
    useShallow((s) => ({
      L: s.L,
      W: s.W,
      eave: s.eave,
      openings: s.openings,
      parts: s.parts,
      cladCol: s.cladCol,
      wallTypes: s.wallTypes,
    })),
  );

  const g = planGeom(S);
  const { sc, w, h, x0, y0, tt } = g;
  const cHex = cladHex(S.cladCol);
  const eaveOff = (S.eave || 450) * sc;

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        {/* eave outline */}
        <rect
          x={x0 - eaveOff}
          y={y0 - eaveOff}
          width={w + 2 * eaveOff}
          height={h + 2 * eaveOff}
          fill="none"
          stroke="#b9b09c"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        {/* slab fill */}
        <rect
          x={x0 + tt}
          y={y0 + tt}
          width={w - 2 * tt}
          height={h - 2 * tt}
          fill={cHex}
          opacity={0.3}
          data-node-id="slab"
          data-node-type="Slab"
        />
        {/* perimeter walls, styled per §7.1 wall-type */}
        <WallStrips x0={x0} y0={y0} w={w} h={h} tt={tt} types={S.wallTypes} />
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          fill="none"
          stroke="#1d2a2a"
          strokeWidth={2}
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
          strokeWidth={1}
        />

        {(() => {
          const overlaps = overlappingOpeningIds(S.openings);
          return S.openings.map((o) => {
            const pl = openPlace(S, o, g);
            const stroke = overlaps.has(o.id) ? "#c93535" : KIND_COL[o.kind];
            const sw = o.kind === "Garage" ? 3 : 2.2;
            const halo = overlaps.has(o.id) ? (
              <title>Overlaps another opening on this wall</title>
            ) : null;
            if (pl.horiz) {
              const ax = Math.max(x0, Math.min(x0 + w - pl.owid, pl.cx - pl.owid / 2));
              return (
                <g key={o.id}>
                  <rect
                    x={ax}
                    y={pl.cy - tt / 2 - 1}
                    width={pl.owid}
                    height={tt + 2}
                    fill="#fbf9f3"
                  />
                  {overlaps.has(o.id) && (
                    <rect
                      x={ax - 2}
                      y={pl.cy - tt / 2 - 3}
                      width={pl.owid + 4}
                      height={tt + 6}
                      fill="none"
                      stroke="#c93535"
                      strokeWidth={0.6}
                      strokeDasharray="3 2"
                    />
                  )}
                  <line
                    x1={ax}
                    y1={pl.cy}
                    x2={ax + pl.owid}
                    y2={pl.cy}
                    stroke={stroke}
                    strokeWidth={sw}
                    data-node-id={`opening-${o.id}`}
                    data-node-type="Opening"
                  >
                    {halo}
                  </line>
                </g>
              );
            }
            const ay = Math.max(y0, Math.min(y0 + h - pl.owid, pl.cy - pl.owid / 2));
            return (
              <g key={o.id}>
                <rect
                  x={pl.cx - tt / 2 - 1}
                  y={ay}
                  width={tt + 2}
                  height={pl.owid}
                  fill="#fbf9f3"
                />
                {overlaps.has(o.id) && (
                  <rect
                    x={pl.cx - tt / 2 - 3}
                    y={ay - 2}
                    width={tt + 6}
                    height={pl.owid + 4}
                    fill="none"
                    stroke="#c93535"
                    strokeWidth={0.6}
                    strokeDasharray="3 2"
                  />
                )}
                <line
                  x1={pl.cx}
                  y1={ay}
                  x2={pl.cx}
                  y2={ay + pl.owid}
                  stroke={stroke}
                  strokeWidth={sw}
                  data-node-id={`opening-${o.id}`}
                  data-node-type="Opening"
                >
                  {halo}
                </line>
              </g>
            );
          });
        })()}

        {S.parts.map((p) => {
          const across = p.dir === "Across width";
          if (across) {
            const px = x0 + (p.off / S.L) * w;
            const ys = y0 + (p.start / S.W) * h;
            const yl = (p.len / S.W) * h;
            return (
              <line
                key={p.id}
                x1={px}
                y1={ys}
                x2={px}
                y2={ys + yl}
                stroke="#1d2a2a"
                strokeWidth={1.4}
                data-node-id={`part-${p.id}`}
                data-node-type="Partition"
              />
            );
          }
          const py = y0 + (p.off / S.W) * h;
          const xs = x0 + (p.start / S.L) * w;
          const xl = (p.len / S.L) * w;
          return (
            <line
              key={p.id}
              x1={xs}
              y1={py}
              x2={xs + xl}
              y2={py}
              stroke="#1d2a2a"
              strokeWidth={1.4}
              data-node-id={`part-${p.id}`}
              data-node-type="Partition"
            />
          );
        })}

        {(["N", "S", "E", "W"] as WallKey[]).map((wl) => {
          let tx = 0,
            ty = 0;
          if (wl === "N") {
            tx = x0 + w / 2;
            ty = y0 - 8;
          } else if (wl === "S") {
            tx = x0 + w / 2;
            ty = y0 + h + 14;
          } else if (wl === "W") {
            tx = x0 - 8;
            ty = y0 + h / 2;
          } else {
            tx = x0 + w + 8;
            ty = y0 + h / 2;
          }
          return (
            <text
              key={wl}
              x={tx}
              y={ty}
              fill="#9a8f78"
              fontSize={8}
              fontFamily="IBM Plex Mono"
              textAnchor={wl === "W" ? "end" : wl === "E" ? "start" : "middle"}
              data-node-id={`wall-${wl}`}
              data-node-type="Wall"
            >
              {WALLNAME[wl]}
            </text>
          );
        })}
        <PartyWalls />
        <PlanDimensions />
        <PlanAnnotations />
        <WallLegend />
        <SheetFrame />
      </svg>
      <ScaleChip label={`plan ≈1:${Math.round(1000 / sc)}`} />
    </ClickLayer>
  );
}

export function ScaleChip({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 14,
        top: 8,
        fontFamily: "var(--astral-mono)",
        fontSize: 10,
        color: "var(--astral-ink2)",
      }}
    >
      {label}
    </div>
  );
}
