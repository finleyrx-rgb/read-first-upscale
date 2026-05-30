// §7 plan-set annotations: north point, A–A / B–B section markers, wall-type
// legend, construction-detail callouts + key. Ported from drawAnnotations() /
// drawCallouts() / drawWallLegend() / drawSectionMarkers() in public/astral.html.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { openPlace, planGeom } from "@/lib/astral/geom";
import { SHEET_INDEX } from "@/lib/astral/sheet";

const MONO = "IBM Plex Mono";
const INK = "#1d2a2a";
const ORANGE = "#bf6b2c";

function calloutRef(key: string) {
  const ix = SHEET_INDEX[key];
  if (!ix) return { ref: "-", sheet: "A5.--" };
  const seq = String(ix.seq).padStart(2, "0");
  return { ref: seq, sheet: `${ix.prefix}.${seq}` };
}

function NorthPoint({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={11} fill="#fbf9f3" stroke="#cfc6b4" strokeWidth={0.8} />
      <path d={`M ${x} ${y - 9} L ${x + 4} ${y + 5} L ${x} ${y + 1} L ${x - 4} ${y + 5} Z`} fill={INK} />
      <text x={x} y={y + 18} fill="#7a6f57" fontSize={7} fontFamily={MONO} textAnchor="middle">N</text>
    </g>
  );
}

function SectionTag({ x, y, dir, tag, cut }: { x: number; y: number; dir: "left" | "right"; tag: string; cut: "cross" | "long" }) {
  const d = dir === "left" ? -1 : 1;
  return (
    <g data-section-cut={cut} style={{ cursor: "pointer" }}>
      <circle cx={x} cy={y} r={10} fill="#fbf9f3" stroke={INK} strokeWidth={1} />
      <text x={x} y={y + 3.2} fill={INK} fontSize={8.5} fontFamily={MONO} textAnchor="middle">{tag}</text>
      <path d={`M ${x + 10 * d} ${y - 6} L ${x + 18 * d} ${y} L ${x + 10 * d} ${y + 6} Z`} fill={INK} />
    </g>
  );
}

function SectionMarkers() {
  const S = useAstral(useShallow((s) => ({ L: s.L, W: s.W })));
  const { w, h, x0, y0 } = planGeom(S);
  const ax = x0 + w / 2;
  const by = y0 + h / 2;
  return (
    <g>
      {/* A–A cross — vertical */}
      <line x1={ax} y1={y0 - 44} x2={ax} y2={y0 + h + 44}
        stroke={INK} strokeWidth={0.7} strokeDasharray="10 3 2 3" pointerEvents="none" />
      <SectionTag x={ax} y={y0 - 44} dir="left" tag="A" cut="cross" />
      <SectionTag x={ax} y={y0 + h + 44} dir="right" tag="A" cut="cross" />
      {/* B–B long — horizontal */}
      <line x1={x0 - 46} y1={by} x2={x0 + w + 46} y2={by}
        stroke={INK} strokeWidth={0.7} strokeDasharray="10 3 2 3" pointerEvents="none" />
      <SectionTag x={x0 - 46} y={by} dir="left" tag="B" cut="long" />
      <SectionTag x={x0 + w + 46} y={by} dir="right" tag="B" cut="long" />
    </g>
  );
}

// (Legacy partition-type swatch removed — wall types now rendered via
// WallLegend.tsx using the new §7.1 master-plan taxonomy.)

function CalloutBubble({ bx, by, tx, ty, k, nodeId }:
  { bx: number; by: number; tx: number; ty: number; k: string; nodeId?: string }) {
  const r = calloutRef(k);
  return (
    <g>
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke={ORANGE} strokeWidth={0.6}
        strokeDasharray="3 2" pointerEvents="none" />
      <circle cx={tx} cy={ty} r={2} fill={ORANGE} pointerEvents="none" />
      <g data-callout-key={k} data-callout-node={nodeId || ""} style={{ cursor: "pointer" }}>
        <circle cx={bx} cy={by} r={11} fill="#fbf9f3" stroke={ORANGE} strokeWidth={1} />
        <line x1={bx - 11} y1={by} x2={bx + 11} y2={by} stroke={ORANGE} strokeWidth={0.7} />
        <text x={bx} y={by - 2.5} fill={ORANGE} fontSize={8} fontFamily={MONO} textAnchor="middle">{r.ref}</text>
        <text x={bx} y={by + 8.5} fill={ORANGE} fontSize={6.5} fontFamily={MONO} textAnchor="middle">{r.sheet}</text>
      </g>
    </g>
  );
}

function PlanCallouts() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, openings: s.openings, parts: s.parts, eave: s.eave, layer: s.layer,
  })));
  const g = planGeom(S);
  const { w, h, x0, y0, sc } = g;
  const bigOp = [...S.openings].sort((a, b) => b.width - a.width)[0];
  const out: React.ReactNode[] = [];

  if (S.layer !== "foundation") {
    out.push(<CalloutBubble key="wall" bx={x0 + w + 34} by={y0 + h - 12}
      tx={x0 + w * 0.32} ty={y0 + h - 6} k="detail_wall" nodeId="wall-S" />);
    const eo = (S.eave || 450) * sc;
    out.push(<CalloutBubble key="roof" bx={x0 + w + 34} by={y0 - 22}
      tx={x0 + w + eo * 0.5} ty={y0 - eo * 0.5} k="detail_roof" nodeId="roof" />);
    if (bigOp) {
      const pl = openPlace(S, bigOp, g);
      const bx = pl.cx + (pl.horiz ? 0 : (bigOp.wall === "W" ? -32 : 32));
      const by = pl.cy + (pl.horiz ? (bigOp.wall === "N" ? -26 : 26) : 0);
      out.push(<CalloutBubble key="lintel" bx={bx} by={by} tx={pl.cx} ty={pl.cy}
        k="detail_opening" nodeId={`opening-${bigOp.id}`} />);
    }
    // Partition junction callouts — first 2 partitions only to avoid clutter.
    S.parts.slice(0, 2).forEach((p, i) => {
      const across = p.dir === "Across width";
      const px = across ? x0 + (p.off / S.L) * w : x0 + ((p.start + p.len / 2) / S.L) * w;
      const py = across ? y0 + ((p.start + p.len / 2) / S.W) * h : y0 + (p.off / S.W) * h;
      const bx = x0 - 36;
      const by = y0 + h * (0.25 + i * 0.35);
      out.push(<CalloutBubble key={`part-${p.id}`} bx={bx} by={by} tx={px} ty={py}
        k="detail_wall" nodeId={`part-${p.id}`} />);
    });
  } else {
    out.push(<CalloutBubble key="slab1" bx={x0 + w + 34} by={y0 + h + 18}
      tx={x0 + w - 6} ty={y0 + h - 6} k="detail_slab" nodeId="slab" />);
    out.push(<CalloutBubble key="slab2" bx={x0 - 34} by={y0 + h * 0.5}
      tx={x0 + 6} ty={y0 + h * 0.5} k="detail_slab" nodeId="slab" />);
  }
  return <g>{out}</g>;
}

function DetailKey() {
  const items = [
    ["detail_wall", "Wall"],
    ["detail_roof", "Eave"],
    ["detail_slab", "Slab"],
    ["detail_opening", "Lintel"],
  ] as const;
  const bx = 474, by = 98, rh = 13;
  return (
    <g pointerEvents="none">
      <rect x={bx - 4} y={by - 12} width={120} height={items.length * rh + 8}
        fill="#fbf9f3" stroke="#cfc6b4" strokeWidth={0.8} rx={4} opacity={0.94} />
      <text x={bx} y={by - 2} fill="#3c4a47" fontSize={7.5} fontFamily={MONO}
        letterSpacing="0.1em">DETAIL KEY</text>
      {items.map(([k, lab], i) => {
        const r = calloutRef(k);
        const yy = by + 9 + i * rh;
        return (
          <g key={k}>
            <circle cx={bx + 5} cy={yy - 2} r={4.5} fill="#fbf9f3" stroke={ORANGE} strokeWidth={0.7} />
            <text x={bx + 15} y={yy + 1.5} fill={INK} fontSize={8.5} fontFamily={MONO}>{r.sheet} · {lab}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Composite annotations for any architectural/framing/foundation plan view. */
export function PlanAnnotations() {
  return (
    <g>
      <SectionMarkers />
      <NorthPoint x={566} y={56} />
      <PlanCallouts />
      <DetailKey />
    </g>
  );
}

/** Eave / opening / slab callouts for elevation views. */
export function ElevationCallouts() {
  const S = useAstral(useShallow((s) => ({ face: s.face, openings: s.openings })));
  const VW = 600, VH = 440;
  const ox = 80, oy = 70, ow = VW - 160, oh = VH - 160;
  const wallKey = S.face === "front" ? "S" : S.face === "back" ? "N" : S.face === "left" ? "W" : "E";
  const faceOp = S.openings.filter((o) => o.wall === wallKey).sort((a, b) => b.width - a.width)[0];
  return (
    <g>
      <CalloutBubble bx={ox + ow + 30} by={oy - 6} tx={ox + ow - 10} ty={oy + 8}
        k="detail_roof" nodeId="roof" />
      {faceOp && (
        <CalloutBubble bx={ox + ow + 30} by={oy + oh * 0.45}
          tx={ox + ow * 0.55} ty={oy + oh * 0.55}
          k="detail_opening" nodeId={`opening-${faceOp.id}`} />
      )}
      <CalloutBubble bx={ox - 30} by={oy + oh + 8} tx={ox + 8} ty={oy + oh - 4}
        k="detail_slab" nodeId="slab" />
    </g>
  );
}
