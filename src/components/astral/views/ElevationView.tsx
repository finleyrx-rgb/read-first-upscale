import React from "react";
// Elevation view — ported from drawElev() in public/astral.html.
// Honors layer toggle: envelope (arch), framing, concrete (foundation).

import { useMemo } from "react";
import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { FACE_LABEL, FACE_WALL, KIND_COL, braceLayout, cladHex, lintelDepthMM, nogRows, openFrac, openingOH, openingSill, roofHex } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";
import { ElevationCallouts } from "./PlanAnnotations";

const VW = 600, VH = 440, m = 70;

export function ElevationView() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, studH: s.studH, spacing: s.spacing,
    roof: s.roof, pitch: s.pitch, cover: s.cover,
    clad: s.clad, cladCol: s.cladCol, roofCol: s.roofCol,
    eave: s.eave, parapet: s.parapet, units: s.units,
    openings: s.openings, face: s.face, layer: s.layer,
    storeys: s.storeys, floorDepth: s.floorDepth,
  })));

  const data = useMemo(() => {
    const longFace = S.face === "front" || S.face === "back";
    const wall = FACE_WALL[S.face];
    const widmm = longFace ? S.L : S.W;
    const apexmm = (S.W / 2) * Math.tan((S.pitch * Math.PI) / 180);
    const totH = S.studH + (S.roof === "Flat" ? 200 : apexmm);
    const sc = Math.min((VW - 2 * m) / widmm, (VH - 2 * m) / totH);
    const w = widmm * sc, eh = S.studH * sc;
    const x0 = (VW - w) / 2, base = VH - m, eave = base - eh, apexP = apexmm * sc;
    return { longFace, wall, widmm, sc, w, eh, x0, base, eave, apexP };
  }, [S.L, S.W, S.studH, S.roof, S.pitch, S.face]);

  const { longFace, wall, widmm, sc, w, x0, base, eave, apexP } = data;

  const eo = (S.eave || 0) * sc;
  let pts: [number, number][];
  if (S.roof === "Flat") {
    if (S.parapet) {
      const cap = Math.max(8, 300 * sc);
      pts = [[x0 - 6 - eo, eave - cap], [x0 + w + 6 + eo, eave - cap], [x0 + w + 6 + eo, eave + 2], [x0 - 6 - eo, eave + 2]];
    } else {
      pts = [[x0 - 6 - eo, eave - 4], [x0 + w + 6 + eo, eave - 2], [x0 + w + 6 + eo, eave + 2], [x0 - 6 - eo, eave + 2]];
    }
  } else if (S.roof === "Mono") {
    const r = widmm * Math.tan((S.pitch * Math.PI) / 180) * sc;
    pts = !longFace
      ? [[x0 - eo, eave - Math.min(r, apexP * 2)], [x0 + w + eo, eave], [x0 + w + eo, eave + 2], [x0 - eo, eave + 2]]
      : [[x0 - eo, eave - apexP], [x0 + w + eo, eave - apexP], [x0 + w + eo, eave], [x0 - eo, eave]];
  } else if (S.roof === "Gambrel") {
    if (!longFace) {
      const kneeY = eave - apexP * 0.4;
      const kneeX = w * 0.22;
      pts = [
        [x0 - eo, eave],
        [x0, eave],
        [x0 + kneeX, kneeY],
        [x0 + w / 2, eave - apexP],
        [x0 + w - kneeX, kneeY],
        [x0 + w, eave],
        [x0 + w + eo, eave],
      ];
    } else {
      const ridgeY = eave - apexP;
      pts = [[x0 - eo, ridgeY], [x0 + w + eo, ridgeY], [x0 + w + eo, eave], [x0 - eo, eave]];
    }
  } else if (S.roof === "Dutch Gable") {
    if (!longFace) {
      const hipTop = eave - apexP * 0.55;
      const gableTopX = w * 0.32;
      pts = [
        [x0 - eo, eave],
        [x0 + gableTopX, hipTop],
        [x0 + w / 2, eave - apexP],
        [x0 + w - gableTopX, hipTop],
        [x0 + w + eo, eave],
      ];
    } else {
      const ridge = (S.W / 2) * sc;
      pts = [[x0 - eo, eave], [x0 + ridge, eave - apexP], [x0 + w - ridge, eave - apexP], [x0 + w + eo, eave]];
    }
  } else if (!longFace) {
    // Gable end seen — extend eaves out beyond the wall ends along the rake.
    pts = [[x0 - eo, eave + (eo * apexP) / (w / 2 || 1)], [x0 + w / 2, eave - apexP], [x0 + w + eo, eave + (eo * apexP) / (w / 2 || 1)]];
  } else {
    const ridge = S.roof === "Hip" ? (S.W / 2) * sc : S.roof === "Gable" ? 4 : (S.W / 2) * sc;
    pts = [[x0 - eo, eave], [x0 + ridge, eave - apexP], [x0 + w - ridge, eave - apexP], [x0 + w + eo, eave]];
  }

  const ows = (o: typeof S.openings[number]) => {
    const owid = Math.min(o.width, widmm * 0.95) * sc;
    const cxp = x0 + Math.max(owid / 2, Math.min(w - owid / 2, openFrac(S, o) * w));
    const oh = openingOH(o, S.studH) * sc;
    const sill = openingSill(o) * sc;
    return { owid, cxp, oh, sill };
  };

  const facedOpenings = S.openings.filter((o) => o.wall === wall);
  const lName = S.layer === "framing" ? "framing" : S.layer === "foundation" ? "concrete" : "envelope";
  const fName = FACE_LABEL[S.face];

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        <line x1={x0 - 34} y1={base} x2={x0 + w + 34} y2={base} stroke="#3c4a47" strokeWidth={2} />

        {S.layer === "foundation" && <FoundationLayer x0={x0} w={w} eave={eave} eh={data.eh} base={base} />}
        {S.layer === "framing" && (
          <FramingLayer S={S} pts={pts} x0={x0} w={w} eave={eave} base={base} sc={sc} ows={ows}
            facedOpenings={facedOpenings} longFace={longFace} apexP={apexP} wall={wall} widmm={widmm} />
        )}
        {S.layer === "arch" && (
          <ArchLayer S={S} pts={pts} x0={x0} w={w} eave={eave} eh={data.eh} base={base}
            ows={ows} facedOpenings={facedOpenings} />
        )}

        {longFace && S.units > 1 && Array.from({ length: S.units - 1 }).map((_, i) => {
          const px = x0 + ((i + 1) / S.units) * w;
          return (
            <g key={`pwe${i}`}>
              <line x1={px} y1={eave} x2={px} y2={base} stroke="#7a4a16" strokeWidth={1.2} strokeDasharray="6 3" />
              <text x={px} y={eave - 4} fill="#7a4a16" fontSize={8} fontFamily="IBM Plex Mono" textAnchor="middle">party wall</text>
            </g>
          );
        })}

        <text x={x0 + w / 2} y={base + (S.layer === "foundation" ? 36 : 18)}
          fill="#3c4a47" fontSize={11} fontFamily="IBM Plex Mono" textAnchor="middle">
          {fName} · {S.roof}{S.roof === "Flat" && S.parapet ? " + parapet" : ""} {S.pitch}° · {S.layer === "framing" ? "framing" : S.layer === "foundation" ? "concrete" : `${S.cladCol} / ${S.roofCol}`}
        </text>
        <ElevationCallouts />
        <SheetFrame />
      </svg>
      <ScaleChip label={`${fName.toLowerCase()} elevation · ${lName} · indicative`} />
    </ClickLayer>
  );
}

function FoundationLayer({ x0, w, eave, eh, base }: { x0: number; w: number; eave: number; eh: number; base: number }) {
  // §7.3 elevation concrete layer — edge beam profile, DPC, hardfill,
  // anchor bolts, control-joint marks on slab edge, FGL.
  const slabH = 11;
  const edgeBeamH = 18;
  const fgl = base + slabH + 4;       // finished ground level
  const hatch: React.ReactElement[] = [];
  for (let xx = x0 - 18; xx < x0 + w + 18; xx += 9) {
    hatch.push(<line key={`hf${xx}`} x1={xx} y1={fgl} x2={xx - 5} y2={fgl + 10}
      stroke="#8a7c5e" strokeWidth={0.4} />);
  }
  // anchor bolts ~ every 900mm
  const anchors: React.ReactElement[] = [];
  for (let i = 1; i < 8; i++) {
    const ax = x0 + (i / 8) * w;
    anchors.push(<g key={`a${i}`}>
      <circle cx={ax} cy={base + 4} r={1.4} fill="#1d2a2a" />
      <line x1={ax} y1={base} x2={ax} y2={base + slabH - 1} stroke="#1d2a2a" strokeWidth={0.5} />
    </g>);
  }
  // control joints on slab edge (top face)
  const cj: React.ReactElement[] = [];
  for (let i = 1; i <= 2; i++) {
    const cx = x0 + (i / 3) * w;
    cj.push(<g key={`cj${i}`}>
      <line x1={cx} y1={base} x2={cx} y2={base + 4} stroke="#1d2a2a" strokeWidth={0.7} strokeDasharray="2 1" />
      <text x={cx} y={base - 3} fill="#3c4a47" fontSize={6.5} fontFamily="IBM Plex Mono" textAnchor="middle">CJ</text>
    </g>);
  }
  return (
    <g>
      <rect x={x0} y={eave} width={w} height={eh} fill="none" stroke="#cfc6b4" strokeWidth={1} strokeDasharray="4 3" />
      {/* FFL line + label */}
      <line x1={x0 - 22} y1={base} x2={x0 + w + 22} y2={base} stroke="#1d2a2a" strokeWidth={1.4} />
      <text x={x0 + w + 26} y={base + 3} fill="#3c4a47" fontSize={9} fontFamily="IBM Plex Mono">FFL 0</text>
      {/* slab body */}
      <rect x={x0} y={base} width={w} height={slabH} fill="#efeadd" stroke="#1d2a2a" strokeWidth={1.1}
        data-node-id="slab" data-node-type="Slab" />
      {/* DPC line under bottom plate */}
      <line x1={x0} y1={base - 1.2} x2={x0 + w} y2={base - 1.2} stroke="#2f6f7e" strokeWidth={0.8} />
      {/* mesh indicator inside slab */}
      <line x1={x0 + 4} y1={base + slabH / 2} x2={x0 + w - 4} y2={base + slabH / 2}
        stroke="#2f6f7e" strokeWidth={0.4} strokeDasharray="2 2" />
      {/* edge-beam thickening at each end */}
      <rect x={x0 - 2} y={base + slabH} width={20} height={edgeBeamH} fill="#efeadd" stroke="#1d2a2a" strokeWidth={1} />
      <rect x={x0 + w - 18} y={base + slabH} width={20} height={edgeBeamH} fill="#efeadd" stroke="#1d2a2a" strokeWidth={1} />
      {/* edge bars (top + bottom) */}
      <circle cx={x0 + 4} cy={base + slabH + 4} r={1.4} fill="none" stroke="#1d2a2a" strokeWidth={0.6} />
      <circle cx={x0 + 4} cy={base + slabH + edgeBeamH - 4} r={1.4} fill="none" stroke="#1d2a2a" strokeWidth={0.6} />
      <circle cx={x0 + w - 4} cy={base + slabH + 4} r={1.4} fill="none" stroke="#1d2a2a" strokeWidth={0.6} />
      <circle cx={x0 + w - 4} cy={base + slabH + edgeBeamH - 4} r={1.4} fill="none" stroke="#1d2a2a" strokeWidth={0.6} />
      {/* FGL + hardfill hatch */}
      <line x1={x0 - 22} y1={fgl} x2={x0 + w + 22} y2={fgl} stroke="#8a7c5e" strokeWidth={0.6} />
      <text x={x0 + w + 26} y={fgl + 3} fill="#7a6f57" fontSize={8} fontFamily="IBM Plex Mono">FGL</text>
      {hatch}
      {anchors}
      {cj}
      <text x={x0 + w / 2} y={base + slabH + edgeBeamH + 18} fill="#7a6f57" fontSize={9} fontFamily="IBM Plex Mono" textAnchor="middle">
        100 slab · SE82 mesh · DPC · 300 thickened edge (SED) · anchors @900 · CJ ≤6m
      </text>
    </g>
  );
}

type ElevProps = {
  S: { L: number; W: number; studH: number; spacing: number; roof: string; pitch: number; cover: string; clad: string; cladCol: string; roofCol: string; openings: ReturnType<typeof useAstral.getState>["openings"]; face: ReturnType<typeof useAstral.getState>["face"]; layer: ReturnType<typeof useAstral.getState>["layer"]; };
  pts: [number, number][];
  x0: number; w: number; eave: number; base: number;
  ows: (o: ElevProps["S"]["openings"][number]) => { owid: number; cxp: number; oh: number; sill: number };
  facedOpenings: ElevProps["S"]["openings"];
};

function FramingLayer({ S, pts, x0, w, eave, base, sc, ows, facedOpenings, longFace, apexP, wall, widmm }:
  ElevProps & { sc: number; longFace: boolean; apexP: number; wall: string; widmm: number }) {
  const zones = facedOpenings.map((o) => {
    const a = ows(o);
    return { x1: a.cxp - a.owid / 2, x2: a.cxp + a.owid / 2, head: base - a.sill - a.oh, sillY: base - a.sill, kind: o.kind, owid: a.owid, cxp: a.cxp, id: o.id };
  });
  const inZone = (x: number) => zones.find((z) => x > z.x1 - 2 && x < z.x2 + 2);
  const spx = S.spacing * sc;
  const studLines: React.ReactElement[] = [];
  for (let x = x0 + spx; x < x0 + w - 1; x += spx) {
    const z = inZone(x);
    if (!z) {
      studLines.push(<line key={`s${x}`} x1={x} y1={eave + 5} x2={x} y2={base - 3} stroke="#8a7c5e" strokeWidth={0.7} />);
    } else {
      studLines.push(<line key={`sa${x}`} x1={x} y1={eave + 5} x2={x} y2={z.head} stroke="#8a7c5e" strokeWidth={0.45} />);
      if (z.kind === "Window") studLines.push(<line key={`sb${x}`} x1={x} y1={z.sillY} x2={x} y2={base - 3} stroke="#8a7c5e" strokeWidth={0.45} />);
    }
  }
  const rows = nogRows(S.studH);
  const nogLines: React.ReactElement[] = [];
  for (let r = 1; r <= rows; r++) {
    const ny = eave + 5 + ((base - 3) - (eave + 5)) * (r / (rows + 1));
    nogLines.push(<line key={`n${r}`} x1={x0} y1={ny} x2={x0 + w} y2={ny} stroke="#a89a78" strokeWidth={0.5} strokeDasharray="10 4" />);
  }
  const trusses: React.ReactElement[] = [];
  if (longFace) {
    const tspx = 900 * sc;
    let i = 0;
    for (let x = x0 + tspx; x < x0 + w; x += tspx) {
      trusses.push(<line key={`t${i++}`} x1={x} y1={eave} x2={x} y2={eave - apexP * 0.16} stroke="#c8975a" strokeWidth={0.5} />);
    }
  }

  return (
    <g>
      <rect x={x0} y={eave} width={w} height={base - 3 - eave} fill="none" stroke="#1d2a2a" strokeWidth={1}
        data-node-id="building" data-node-type="Building" />
      <line x1={x0} y1={eave + 2} x2={x0 + w} y2={eave + 2} stroke="#8a7c5e" strokeWidth={1.1} />
      <line x1={x0} y1={eave + 5} x2={x0 + w} y2={eave + 5} stroke="#8a7c5e" strokeWidth={1.1} />
      <line x1={x0} y1={base - 3} x2={x0 + w} y2={base - 3} stroke="#8a7c5e" strokeWidth={1.4} />
      {studLines}
      {nogLines}
      {[x0, x0 + w].map((cv) => {
        const d = cv === x0 ? 1 : -1;
        return (
          <g key={cv}>
            <line x1={cv + 2 * d} y1={eave + 5} x2={cv + 2 * d} y2={base - 3} stroke="#1d2a2a" strokeWidth={1} />
            <line x1={cv + 5 * d} y1={eave + 5} x2={cv + 5 * d} y2={base - 3} stroke="#8a7c5e" strokeWidth={0.8} />
          </g>
        );
      })}
      {zones.map((z) => {
        const widthMM = Math.round(z.owid / sc);
        const ld = Math.max(4, lintelDepthMM(widthMM) * sc);
        return (
          <g key={z.id}>
            {[z.x1, z.x2].map((jx) => {
              const d = jx === z.x1 ? -1 : 1;
              return (
                <g key={jx}>
                  <line x1={jx} y1={eave + 5} x2={jx} y2={base - 3} stroke="#1d2a2a" strokeWidth={1} />
                  <line x1={jx + 3 * d} y1={z.head} x2={jx + 3 * d} y2={base - 3} stroke="#8a7c5e" strokeWidth={0.7} />
                </g>
              );
            })}
            <rect x={z.x1 - 3} y={z.head - ld} width={(z.x2 - z.x1) + 6} height={ld}
              fill="#f0e3cf" stroke="#b4472d" strokeWidth={1.1}
              data-node-id={`opening-${z.id}`} data-node-type="Opening" />
            {z.kind === "Window" && (
              <rect x={z.x1} y={z.sillY} width={z.x2 - z.x1} height={3} fill="#a89a78" />
            )}
            {widthMM > 3000 && (
              <text x={z.cxp} y={z.head - ld - 3} fill="#b4472d" fontSize={8} fontFamily="IBM Plex Mono" textAnchor="middle">
                ENG. HEAD (SED)
              </text>
            )}
          </g>
        );
      })}
      {braceLayout(S, wall as "N" | "S" | "E" | "W").map((bp, i) => {
        const bx1 = x0 + (bp.start / widmm) * w;
        const bx2 = x0 + ((bp.start + bp.len) / widmm) * w;
        return (
          <g key={`b${i}`}>
            <rect x={bx1} y={eave + 5} width={bx2 - bx1} height={(base - 3) - (eave + 5)}
              fill="rgba(63,125,84,0.07)" stroke="#3f7d54" strokeWidth={0.8} />
            <line x1={bx1} y1={base - 3} x2={bx2} y2={eave + 5} stroke="#3f7d54" strokeWidth={0.8} />
            <line x1={bx1} y1={eave + 5} x2={bx2} y2={base - 3} stroke="#3f7d54" strokeWidth={0.8} />
            <text x={(bx1 + bx2) / 2} y={base - 7} fill="#3f7d54" fontSize={7} fontFamily="IBM Plex Mono" textAnchor="middle">BL</text>
          </g>
        );
      })}
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#1d2a2a" strokeWidth={1} />
      {!longFace ? (
        <g>
          <line x1={x0} y1={eave} x2={x0 + w} y2={eave} stroke="#8a7c5e" strokeWidth={0.7} />
          <line x1={x0 + w / 2} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke="#8a7c5e" strokeWidth={0.6} />
          <line x1={x0 + w * 0.25} y1={eave} x2={x0 + w * 0.42} y2={eave - apexP * 0.55} stroke="#8a7c5e" strokeWidth={0.5} />
          <line x1={x0 + w * 0.75} y1={eave} x2={x0 + w * 0.58} y2={eave - apexP * 0.55} stroke="#8a7c5e" strokeWidth={0.5} />
        </g>
      ) : trusses}
      <text x={x0 + w / 2} y={eave - 6} fill="#3f7d54" fontSize={8} fontFamily="IBM Plex Mono" textAnchor="middle">
        bracing (green) indicative — confirm BU demand
      </text>
    </g>
  );
}

function ArchLayer({ S, pts, x0, w, eave, eh, ows, facedOpenings, base }: ElevProps & { eh: number }) {
  const cHex = cladHex(S.cladCol);
  const rHex = roofHex(S.roofCol);
  return (
    <g>
      <CladTexture x={x0} y={eave} w={w} h={eh} kind={S.clad} color={cHex} />
      <rect x={x0} y={eave} width={w} height={eh} fill="none" stroke="#1d2a2a" strokeWidth={1.4}
        data-node-id="building" data-node-type="Building" />
      <RoofTexture pts={pts} color={rHex} cover={S.cover} />
      <line x1={x0 - 8} y1={eave} x2={x0} y2={eave} stroke="#1d2a2a" strokeWidth={1} />
      <line x1={x0 + w} y1={eave} x2={x0 + w + 8} y2={eave} stroke="#1d2a2a" strokeWidth={1} />
      {facedOpenings.map((o) => {
        const { owid, cxp, oh, sill } = ows(o);
        const col = KIND_COL[o.kind];
        return (
          <g key={o.id}>
            <rect x={cxp - owid / 2} y={base - sill - oh} width={owid} height={oh}
              fill="#ffffff" opacity={0.55} stroke={col} strokeWidth={o.kind === "Garage" ? 2.4 : 1.6}
              data-node-id={`opening-${o.id}`} data-node-type="Opening" />
            {o.kind === "Window" && (
              <>
                <line x1={cxp} y1={base - sill - oh} x2={cxp} y2={base - sill} stroke={col} strokeWidth={0.8} />
                <line x1={cxp - owid / 2} y1={base - sill - oh / 2} x2={cxp + owid / 2} y2={base - sill - oh / 2} stroke={col} strokeWidth={0.8} />
              </>
            )}
            {o.kind === "Garage" && o.width > 3000 && (
              <text x={cxp} y={base - oh - 4} fill="#b4472d" fontSize={9} fontFamily="IBM Plex Mono" textAnchor="middle">
                ENG. HEAD
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function CladTexture({ x, y, w, h, kind, color }: { x: number; y: number; w: number; h: number; kind: string; color: string }) {
  const lines: React.ReactElement[] = [];
  if (kind === "Weatherboard") {
    for (let yy = y + 6; yy < y + h; yy += 6) lines.push(<line key={yy} x1={x} y1={yy} x2={x + w} y2={yy} stroke="#00000022" strokeWidth={0.6} />);
  } else if (kind === "Ply + batten") {
    for (let xx = x + 10; xx < x + w; xx += 20) lines.push(<line key={xx} x1={xx} y1={y} x2={xx} y2={y + h} stroke="#00000022" strokeWidth={0.8} />);
  } else if (kind === "Fibre-cement") {
    for (let xx = x + 24; xx < x + w; xx += 24) lines.push(<line key={xx} x1={xx} y1={y} x2={xx} y2={y + h} stroke="#00000018" strokeWidth={0.5} />);
  }
  return <g><rect x={x} y={y} width={w} height={h} fill={color} />{lines}</g>;
}

function RoofTexture({ pts, color, cover }: { pts: [number, number][]; color: string; cover: string }) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const step = cover.indexOf("corrugate") > -1 ? 7 : cover.indexOf("tray") > -1 ? 16 : 0;
  const lines: React.ReactElement[] = [];
  if (step) for (let xx = minx + step; xx < maxx; xx += step) lines.push(<line key={xx} x1={xx} y1={miny} x2={xx} y2={maxy} stroke="#ffffff22" strokeWidth={0.6} />);
  return (
    <g>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={color} stroke="#1d2a2a" strokeWidth={1}
        data-node-id="roof" data-node-type="RoofSystem" />
      {lines}
    </g>
  );
}
