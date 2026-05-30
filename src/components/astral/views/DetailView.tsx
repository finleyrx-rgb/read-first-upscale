// Detail view — ported from drawDetail() in public/astral.html.
// Renders construction details for selected node (Wall/Building, RoofSystem, Slab, Opening).

import React, { useMemo } from "react";
import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { buildModel } from "@/lib/astral/model";
import { lintelRule, studRule, tieRule } from "@/lib/astral/model";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";

const INK = "#1d2a2a";

function L1(x1: number, y1: number, x2: number, y2: number, lw = 1, col = INK) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={lw} />;
}
function R(x: number, y: number, w: number, h: number, fill: string | undefined) {
  return <rect x={x} y={y} width={w} height={h} fill={fill || "none"} stroke={INK} strokeWidth={0.9} />;
}
function T(x: number, y: number, t: string, sz = 8.5, anc: "start" | "middle" | "end" = "start", col = "#3c4a47") {
  return <text x={x} y={y} fill={col} fontSize={sz} fontFamily="IBM Plex Mono" textAnchor={anc}>{t}</text>;
}
function Lead({ x, y, tx, ty, t, k }: { x: number; y: number; tx: number; ty: number; t: string; k: string }) {
  return (
    <g key={k}>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke="#8a7c5e" strokeWidth={0.4} />
      <circle cx={x} cy={y} r={1.4} fill={INK} />
      <text x={tx + (tx >= x ? 3 : -3)} y={ty} fill="#3c4a47" fontSize={8.5} fontFamily="IBM Plex Mono"
        textAnchor={tx >= x ? "start" : "end"}>{t}</text>
    </g>
  );
}

export function DetailView() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, studH: s.studH, spacing: s.spacing, wind: s.wind, found: s.found,
    roof: s.roof, pitch: s.pitch, cover: s.cover, struct: s.struct, eave: s.eave,
    clad: s.clad, cladCol: s.cladCol, roofCol: s.roofCol, lining: s.lining,
    joinery: s.joinery, floor: s.floor, insul: s.insul, type: s.type,
    openings: s.openings, parts: s.parts,
    detailFor: s.detailFor,
  })));
  const M = useMemo(() => buildModel(S as never), [S]);
  const node = S.detailFor && M.byId[S.detailFor] ? M.byId[S.detailFor] : null;
  const ty = node ? node.type : "none";

  const title =
    ty === "RoofSystem" ? "EAVE DETAIL"
    : ty === "Slab" ? "SLAB EDGE / FOOTING DETAIL"
    : ty === "Opening" ? "LINTEL / HEAD DETAIL"
    : (ty === "Wall" || ty === "Building") ? "WALL FRAMING DETAIL"
    : "DETAIL";

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        <rect x={16} y={12} width={568} height={416} fill="none" stroke="#cfc6b4" strokeWidth={1} />
        {T(300, 32, title, 12, "middle", INK)}
        {T(300, 46, "(indicative · refer engineer for SED items)", 8, "middle", "#8a7c5e")}
        {(ty === "Wall" || ty === "Building") && <WallDetail S={S} node={node} />}
        {ty === "RoofSystem" && <RoofDetail S={S} node={node} />}
        {ty === "Slab" && <SlabDetail />}
        {ty === "Opening" && <OpeningDetail S={S} node={node} />}
        {ty === "none" && T(300, 220, 'Select a wall, roof, slab or opening on a plan, then tap "Construction detail".', 9, "middle", "#8a7c5e")}
        {T(300, 420, "tap a plan / elevation tab to return", 8, "middle", "#8a7c5e")}
        <SheetFrame />
      </svg>
      <ScaleChip label="construction detail · indicative, not to scale" />
    </ClickLayer>
  );
}

type DS = ReturnType<typeof useAstral.getState>;
type Node = { derived?: Record<string, unknown> } | null;

function WallDetail({ S, node }: { S: Pick<DS, "L" | "W" | "studH" | "spacing" | "wind" | "found" | "roof" | "pitch" | "cover" | "struct" | "eave" | "clad" | "cladCol" | "roofCol" | "lining" | "joinery" | "floor" | "insul" | "type" | "openings" | "parts">; node: Node }) {
  const cx = 255, fy = 372, topY = 120, ww = 60;
  const cavity = !/plaster/i.test(S.clad);
  const studs = ((node?.derived?.studs as { size?: string } | undefined)?.size) || studRule(S as never).v;
  const tie = tieRule(S as never).v;
  const items: React.ReactNode[] = [];
  items.push(L1(cx - 160, fy, cx + 160, fy, 1.6));
  items.push(R(cx - ww / 2, fy - 13, ww, 13, "#e7e0d0"));
  items.push(L1(cx - ww / 2, fy - 13.6, cx + ww / 2, fy - 13.6, 1.3, "#2f6f7e"));
  items.push(R(cx - ww / 2, topY - 20, ww, 20, "#e7e0d0"));
  items.push(L1(cx - ww / 2, topY, cx - ww / 2, fy - 13, 1.1));
  items.push(L1(cx + ww / 2, topY, cx + ww / 2, fy - 13, 1.1));
  for (let y = topY + 14; y < fy - 18; y += 15) items.push(L1(cx - ww / 2 + 3, y, cx + ww / 2 - 3, y - 9, 0.4, "#cdbf9f"));
  items.push(L1(cx - ww / 2 - 5, topY - 20, cx - ww / 2 - 5, fy, 0.7, "#a89a78"));
  if (cavity) {
    for (let y = topY - 8; y < fy - 12; y += 24) items.push(R(cx - ww / 2 - 10, y, 4, 15, undefined));
    items.push(L1(cx - ww / 2 - 14, topY - 20, cx - ww / 2 - 14, fy, 1.2, "#bf6b2c"));
  } else {
    items.push(L1(cx - ww / 2 - 9, topY - 20, cx - ww / 2 - 9, fy, 1.3, "#bf6b2c"));
  }
  items.push(L1(cx + ww / 2 + 8, topY - 20, cx + ww / 2 + 8, fy, 0.9, "#2f6f7e"));
  items.push(<circle key="anchor" cx={cx} cy={fy - 6} r={2} fill={INK} />);
  return (
    <g>
      {items.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
      <Lead k="tp" x={cx} y={topY - 10} tx={cx + 150} ty={topY - 10} t="2/90×45 top plate" />
      <Lead k="st" x={cx - ww / 2} y={(topY + fy) / 2 - 24} tx={cx + 150} ty={(topY + fy) / 2 - 24} t={`${studs} (H1.2)`} />
      <Lead k="wr" x={cx - ww / 2 - 5} y={fy - 150} tx={cx - 150} ty={fy - 150} t="building wrap" />
      {cavity && <Lead k="cv" x={cx - ww / 2 - 10} y={fy - 115} tx={cx - 150} ty={fy - 115} t="20mm cavity batten" />}
      <Lead k="cl" x={cx - ww / 2 - (cavity ? 14 : 9)} y={fy - 78} tx={cx - 150} ty={fy - 78} t={S.clad} />
      <Lead k="ln" x={cx + ww / 2 + 8} y={fy - 100} tx={cx + 150} ty={fy - 100} t={`${S.lining} lining`} />
      <Lead k="dpc" x={cx} y={fy - 13.6} tx={cx + 150} ty={fy - 44} t="DPC under plate" />
      <Lead k="pf" x={cx} y={fy - 6} tx={cx - 150} ty={fy - 6} t={`plate fix: ${tie.indexOf("chem") > -1 ? "M12 chem anchor @600" : "proprietary anchor @900"}`} />
      <Lead k="bp" x={cx - ww / 2} y={fy - 13} tx={cx - 150} ty={fy - 26} t="bottom plate H3.2" />
    </g>
  );
}

function RoofDetail({ S, node }: { S: Pick<DS, "pitch" | "eave" | "cover">; node: Node }) {
  const ex = 300, ey = 250, run = 170;
  const slope = Math.tan((S.pitch * Math.PI) / 180);
  const rise = run * slope, oh = 60;
  const sys = (node?.derived?.system as string | undefined) || "truss";
  return (
    <g>
      {R(ex - 30, ey, 40, 14, "#e7e0d0")}
      {L1(ex - oh, ey + oh * slope, ex + run, ey - rise, 1.3)}
      {L1(ex - oh, ey - 7 + oh * slope, ex + run, ey - rise - 7, 1.2, "#bf6b2c")}
      {L1(ex - oh, ey - 3 + oh * slope, ex + run, ey - rise - 3, 0.5, "#a89a78")}
      {R(ex + 28, ey - 30, 8, 8, undefined)}
      {L1(ex - oh, ey + oh * slope - 6, ex - oh, ey + oh * slope + 30, 1.3)}
      {L1(ex - 30, ey + 16, ex - oh, ey + oh * slope + 10, 0.9)}
      {L1(ex - 6, ey, ex + 8, ey - 7, 0.6)}
      <path d={`M ${ex - oh - 6} ${ey + oh * slope + 30} a 6 6 0 1 0 12 0`} fill="none" stroke={INK} strokeWidth={0.9} />
      {L1(ex - oh, ey + 96, ex, ey + 96, 0.5)}
      {L1(ex - oh, ey + 92, ex - oh, ey + 100, 0.5)}
      {L1(ex, ey + 92, ex, ey + 100, 0.5)}
      {T(ex - oh / 2, ey + 108, `${S.eave} overhang`, 8.5, "middle")}
      <Lead k="r1" x={ex + run} y={ey - rise} tx={ex + run + 4} ty={ey - rise} t="to ridge" />
      <Lead k="r2" x={ex + 32} y={ey - 26} tx={ex + 92} ty={ey - 64} t="70×45 purlin · clip fix" />
      <Lead k="r3" x={ex + 120} y={ey - rise * 0.7 - 7} tx={ex + 150} ty={ey - rise * 0.7 - 46} t={`${S.cover} + underlay`} />
      <Lead k="r4" x={ex - oh} y={ey + oh * slope + 18} tx={ex - 150} ty={ey + 74} t="fascia + spouting" />
      <Lead k="r5" x={ex - 30} y={ey + 16} tx={ex - 150} ty={ey + 16} t="soffit lining + bearer" />
      <Lead k="r6" x={ex - 30} y={ey} tx={ex - 150} ty={ey - 12} t="fix: cyclone clip / strap each truss" />
      <Lead k="r7" x={ex - 8} y={ey + 7} tx={ex + 150} ty={ey + 30} t={`${sys} @900`} />
    </g>
  );
}

function SlabDetail() {
  const gx = 300, gl = 372;
  const hatch: React.ReactNode[] = [];
  for (let x = gx - 156; x < gx + 160; x += 12) hatch.push(L1(x, gl, x - 6, gl + 8, 0.4, "#8a7c5e"));
  const mesh: React.ReactNode[] = [];
  for (let x = gx - 92; x < gx + 140; x += 22) mesh.push(<circle key={x} cx={x} cy={gl - 38} r={1.3} fill={INK} />);
  return (
    <g>
      {L1(gx - 160, gl, gx + 160, gl, 1.4)}
      {hatch.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
      <path d={`M ${gx - 150} ${gl - 42} L ${gx + 150} ${gl - 42} L ${gx + 150} ${gl - 30} L ${gx - 104} ${gl - 30} L ${gx - 126} ${gl - 4} L ${gx - 150} ${gl - 4} Z`}
        fill="#efeadd" stroke={INK} strokeWidth={1.1} />
      {mesh}
      {[gl - 17, gl - 10].map((yy) => (
        <circle key={yy} cx={gx - 138} cy={yy} r={1.7} fill="none" stroke={INK} strokeWidth={0.7} />
      ))}
      {L1(gx - 150, gl - 28, gx + 150, gl - 28, 0.7, "#2f6f7e")}
      {L1(gx - 150, gl - 28, gx - 150, gl - 4, 0.7, "#2f6f7e")}
      {L1(gx - 148, gl - 26, gx + 148, gl - 26, 0.4, "#a89a78")}
      <Lead k="s1" x={gx + 40} y={gl - 42} tx={gx + 150} ty={gl - 78} t="100 slab · SE82 mesh" />
      <Lead k="s2" x={gx - 138} y={gl - 13} tx={gx - 162} ty={gl - 72} t="edge bars (SED)" />
      <Lead k="s3" x={gx - 126} y={gl - 12} tx={gx - 150} ty={gl - 46} t="300 thickened edge" />
      <Lead k="s4" x={gx - 150} y={gl - 28} tx={gx - 200} ty={gl - 28} t="DPM up edge" />
      <Lead k="s5" x={gx - 118} y={gl - 2} tx={gx - 150} ty={gl + 16} t="compacted hardfill + blinding" />
    </g>
  );
}

function OpeningDetail({ S, node }: { S: Pick<DS, "openings" | "studH">; node: Node }) {
  const id = useAstral.getState().detailFor;
  const o = S.openings.find((z) => `opening-${z.id}` === id) || null;
  const wmm = o ? o.width : 2000;
  const headMM = o ? (o.head ?? (o.kind === "Garage" ? Math.min(S.studH - 200, 2400) : o.kind === "Door" ? 1980 : 2000)) : 2000;
  const sillMM = o ? (o.sill ?? (o.kind === "Window" ? 900 : 0)) : 0;
  const cx = 300, top = 156, opH = 176, half = 115, plY = top - 30;
  const lintel = (node?.derived as { lintel?: { v: string } } | undefined)?.lintel?.v || lintelRule(wmm).v;
  const studHatch: React.ReactNode[] = [];
  for (let x = cx - half + 12; x < cx + half; x += 34) studHatch.push(L1(x, plY + 14, x, top, 0.6, "#8a7c5e"));
  return (
    <g>
      {R(cx - half - 12, plY, 2 * half + 24, 14, "#e7e0d0")}
      {studHatch.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
      {R(cx - half, top, 2 * half, 16, "#f0e3cf")}
      {R(cx - half, top + 16, 2 * half, 8, "#f0e3cf")}
      {[cx - half, cx + half].map((jx) => {
        const d = jx < cx ? -1 : 1;
        return (
          <g key={jx}>
            {L1(jx, top, jx, top + 24 + opH, 1.3)}
            {L1(jx + 7 * d, top, jx + 7 * d, top + 24 + opH, 1)}
          </g>
        );
      })}
      {T(cx, top + 24 + opH / 2, `${o ? o.kind : "opening"} ${wmm} W`, 9, "middle", "#8a7c5e")}
      {o && o.kind === "Window" && L1(cx - half - 12, top - 2, cx + half + 12, top - 2, 1.3, "#2f6f7e")}
      <Lead k="o1" x={cx} y={top + 8} tx={cx + half + 34} ty={top + 8} t={lintel} />
      <Lead k="o2" x={cx - half + 12} y={plY + 22} tx={cx - half - 58} ty={plY + 22} t="jack studs" />
      <Lead k="o3" x={cx - half} y={top + 90} tx={cx - half - 58} ty={top + 90} t="2/ trimming studs" />
      <Lead k="o4" x={cx} y={plY + 7} tx={cx + half + 34} ty={plY - 6} t="2/90×45 top plate" />
      <Lead k="hd" x={cx + half} y={top + 24} tx={cx + half + 34} ty={top + 40} t={`head ${headMM} AFFL`} />
      {sillMM > 0 && (
        <Lead k="sl" x={cx - half} y={top + 24 + opH} tx={cx - half - 58} ty={top + 24 + opH} t={`sill ${sillMM} AFFL`} />
      )}
      {o && o.kind === "Window" && (
        <Lead k="o5" x={cx + half} y={top - 2} tx={cx + half + 34} ty={top - 20} t="head flashing" />
      )}
      {wmm > 3000 && T(cx, plY - 10, "WIDE OPENING — ENGINEERED HEAD (SED)", 8.5, "middle", "#b4472d")}
    </g>
  );
}
