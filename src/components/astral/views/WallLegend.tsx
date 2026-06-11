// §7.1 wall-type legend block. Renders on the architectural plan.

import { WALL_TYPES, WALL_TYPE_STYLES } from "@/lib/astral/wallTypes";

const W = 142;
const ROW = 14;

export function WallLegend({ x = 12, y = 18 }: { x?: number; y?: number }) {
  const items = WALL_TYPES;
  const h = items.length * ROW + 10;
  return (
    <g pointerEvents="none" aria-hidden>
      <rect
        x={x - 4}
        y={y - 12}
        width={W}
        height={h}
        rx={4}
        fill="#fbf9f3"
        stroke="#cfc6b4"
        strokeWidth={0.8}
        opacity={0.94}
      />
      <text
        x={x}
        y={y - 2}
        fill="#3c4a47"
        fontSize={7.5}
        fontFamily="IBM Plex Mono"
        letterSpacing="0.1em"
      >
        WALL TYPES
      </text>
      {items.map((t, i) => {
        const st = WALL_TYPE_STYLES[t];
        const yy = y + 10 + i * ROW;
        return (
          <g key={t}>
            <rect
              x={x}
              y={yy - 6}
              width={18}
              height={9}
              fill={st.fill}
              stroke={st.stroke}
              strokeWidth={Math.min(1, st.strokeWidth)}
              strokeDasharray={st.dash}
            />
            {st.hatch === "diag" &&
              Array.from({ length: 8 }).map((_, k) => (
                <line
                  key={k}
                  x1={x + k * 3 - 4}
                  y1={yy + 3}
                  x2={x + k * 3 + 5}
                  y2={yy - 6}
                  stroke={st.stroke}
                  strokeWidth={0.4}
                  opacity={0.6}
                />
              ))}
            {st.hatch === "dot" &&
              Array.from({ length: 18 }).map((_, k) => (
                <circle
                  key={k}
                  cx={x + 2 + (k % 6) * 3}
                  cy={yy - 4 + Math.floor(k / 6) * 3}
                  r={0.4}
                  fill={st.stroke}
                  opacity={0.7}
                />
              ))}
            {st.hatch === "double" && (
              <>
                <line
                  x1={x + 2}
                  y1={yy - 4}
                  x2={x + 16}
                  y2={yy - 4}
                  stroke={st.stroke}
                  strokeWidth={0.5}
                />
                <line
                  x1={x + 2}
                  y1={yy + 1}
                  x2={x + 16}
                  y2={yy + 1}
                  stroke={st.stroke}
                  strokeWidth={0.5}
                />
              </>
            )}
            <text x={x + 24} y={yy + 2} fill="#1d2a2a" fontSize={8.2} fontFamily="IBM Plex Mono">
              {st.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Paints the 4 perimeter wall strips with per-wall type styling. */
export function WallStrips({
  x0,
  y0,
  w,
  h,
  tt,
  types,
}: {
  x0: number;
  y0: number;
  w: number;
  h: number;
  tt: number;
  types: Record<"N" | "S" | "E" | "W", import("@/lib/astral/wallTypes").WallType>;
}) {
  const rect = (side: "N" | "S" | "E" | "W") => {
    if (side === "N") return { x: x0, y: y0, width: w, height: tt };
    if (side === "S") return { x: x0, y: y0 + h - tt, width: w, height: tt };
    if (side === "W") return { x: x0, y: y0, width: tt, height: h };
    return { x: x0 + w - tt, y: y0, width: tt, height: h };
  };
  return (
    <g>
      {(["N", "S", "E", "W"] as const).map((side) => {
        const st = WALL_TYPE_STYLES[types[side]];
        const r = rect(side);
        return (
          <g key={side} data-node-id={`wall-${side}`} data-node-type="Wall">
            <rect
              {...r}
              fill={st.fill}
              stroke={st.stroke}
              strokeWidth={st.strokeWidth}
              strokeDasharray={st.dash}
            />
            {st.hatch === "diag" && (
              <g clipPath={`url(#wall-clip-${side})`}>
                {Array.from({ length: Math.ceil((r.width + r.height) / 4) }).map((_, k) => {
                  const off = k * 4 - r.height;
                  return (
                    <line
                      key={k}
                      x1={r.x + off}
                      y1={r.y + r.height}
                      x2={r.x + off + r.height}
                      y2={r.y}
                      stroke={st.stroke}
                      strokeWidth={0.4}
                      opacity={0.55}
                    />
                  );
                })}
              </g>
            )}
            {st.hatch === "double" &&
              (() => {
                const inset = Math.max(1.2, tt * 0.28);
                if (side === "N" || side === "S") {
                  return (
                    <>
                      <line
                        x1={r.x}
                        y1={r.y + inset}
                        x2={r.x + r.width}
                        y2={r.y + inset}
                        stroke={st.stroke}
                        strokeWidth={0.6}
                      />
                      <line
                        x1={r.x}
                        y1={r.y + r.height - inset}
                        x2={r.x + r.width}
                        y2={r.y + r.height - inset}
                        stroke={st.stroke}
                        strokeWidth={0.6}
                      />
                    </>
                  );
                }
                return (
                  <>
                    <line
                      x1={r.x + inset}
                      y1={r.y}
                      x2={r.x + inset}
                      y2={r.y + r.height}
                      stroke={st.stroke}
                      strokeWidth={0.6}
                    />
                    <line
                      x1={r.x + r.width - inset}
                      y1={r.y}
                      x2={r.x + r.width - inset}
                      y2={r.y + r.height}
                      stroke={st.stroke}
                      strokeWidth={0.6}
                    />
                  </>
                );
              })()}
            <clipPath id={`wall-clip-${side}`}>
              <rect {...r} />
            </clipPath>
          </g>
        );
      })}
    </g>
  );
}
