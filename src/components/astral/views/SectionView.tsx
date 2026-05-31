import React from "react";
// Section view — §7.4 "Sections": cut at user-chosen line (S.cutPos), structural
// framing shown over envelope, FFL + stud-top datums on both margins, insulation
// R-value schedule, callout bubbles to A5 detail sheets (Oxford convention via
// SectionCallouts).

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { KIND_COL, openFrac, openingOH, openingSill } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";
import { SectionCallouts } from "./PlanAnnotations";

const VW = 600, VH = 440, m = 70;
const INK = "#1d2a2a";
const MONO = "IBM Plex Mono";
const STRUCT = "#7a4a16";
const INSUL = "#c9a04a";
const DATUM = "#3c4a47";

/** Map S.insul preset to R-values for the schedule panel. */
function rValues(insul: string) {
  if (insul.indexOf("Walls") >= 0) return { wall: "R2.6", ceiling: "R3.6", floor: "R1.0 (perim.)" };
  if (insul.indexOf("Ceiling") >= 0) return { wall: "—", ceiling: "R3.6", floor: "R1.0 (perim.)" };
  return { wall: "—", ceiling: "—", floor: "—" };
}

export function SectionView() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, studH: s.studH, eave: s.eave, spacing: s.spacing,
    roof: s.roof, pitch: s.pitch, cut: s.cut, cutPos: s.cutPos,
    openings: s.openings, insul: s.insul, struct: s.struct, cover: s.cover,
    storeys: s.storeys, floorDepth: s.floorDepth,
  })));

  const cut = S.cut === "long" ? "long" : "cross";
  const widmm = cut === "cross" ? S.W : S.L;
  const perpmm = cut === "cross" ? S.L : S.W;
  const cutAtMM = Math.round(S.cutPos * perpmm);
  const apexmm = cut === "cross"
    ? (S.W / 2) * Math.tan((S.pitch * Math.PI) / 180)
    : S.roof === "Mono"
      ? S.L * Math.tan((S.pitch * Math.PI) / 180)
      : (S.W / 2) * Math.tan((S.pitch * Math.PI) / 180);
  const slabT = 100, footing = 200;
  const wallH = S.studH * S.storeys + S.floorDepth * (S.storeys - 1);
  const totH = wallH + (S.roof === "Flat" ? 200 : apexmm) + slabT + footing;
  const sc = Math.min((VW - 2 * m) / widmm, (VH - 2 * m) / totH);
  const w = widmm * sc, eh = wallH * sc;
  const x0 = (VW - w) / 2, base = VH - m - footing * sc;
  const eave = base - eh, apexP = apexmm * sc;
  const firstFloorY = S.storeys === 2 ? base - S.studH * sc : null;
  const tag = cut === "cross" ? "A" : "B";

  let rpts: [number, number][];
  let ridgeLine: { y: number } | null = null;
  const eaveOff = (S.eave || 450) * sc;
  if (S.roof === "Flat") {
    rpts = [[x0 - eaveOff, eave - 6], [x0 + w + eaveOff, eave - 6], [x0 + w + eaveOff, eave - 2], [x0 - eaveOff, eave - 2]];
  } else if (S.roof === "Mono") {
    const r = widmm * Math.tan((S.pitch * Math.PI) / 180) * sc;
    rpts = [
      [x0 - eaveOff, eave - (cut === "cross" ? Math.min(r, apexP * 2) : 0)],
      [x0 + w + eaveOff, eave],
      [x0 + w + eaveOff, eave + 4],
      [x0 - eaveOff, eave + 4],
    ];
  } else if (cut === "long" && (S.roof === "Gable" || S.roof === "Hip")) {
    rpts = [
      [x0 - eaveOff, eave - apexP * 0.05], [x0 + w + eaveOff, eave - apexP * 0.05],
      [x0 + w + eaveOff, eave], [x0 - eaveOff, eave],
    ];
    ridgeLine = { y: eave - apexP };
  } else {
    rpts = [[x0 - eaveOff, eave], [x0 + w / 2, eave - apexP], [x0 + w + eaveOff, eave]];
  }

  const wallT = Math.max(3, 90 * sc);
  // Openings that lie at the cut line (within ±width/2) are sectioned through;
  // others on the same parallel walls project as dashed ghost behind.
  const parallelWalls = cut === "cross" ? ["N", "S"] : ["W", "E"]; // walls perpendicular to cut, seen in elevation
  const perpWalls = cut === "cross" ? ["W", "E"] : ["N", "S"]; // walls parallel to cut — sectioned at the ends
  const parallelOps = S.openings.filter((o) => parallelWalls.indexOf(o.wall) >= 0);
  const cutThroughOps = S.openings.filter((o) => {
    if (perpWalls.indexOf(o.wall) < 0) return false;
    const wallLen = o.wall === "N" || o.wall === "S" ? S.L : S.W;
    // wall axis runs perpendicular to the cut axis — check if cutAtMM crosses the opening
    return Math.abs(o.off - (perpmm - cutAtMM)) < o.width / 2 || Math.abs(o.off - cutAtMM) < o.width / 2;
  });

  const earthHatch: React.ReactElement[] = [];
  for (let xx = x0 - 30; xx < x0 + w + 30; xx += 8) {
    earthHatch.push(<line key={xx} x1={xx} y1={base + (slabT + footing) * sc} x2={xx + 5} y2={base + (slabT + footing) * sc + 5} stroke="#7a6f57" strokeWidth={0.4} />);
  }

  // ── STRUCTURE OVERLAY ────────────────────────────────────────────────────
  // Wall studs (cut) — show as paired short rectangles inside wall thickness
  const studPitch = S.spacing * sc;
  const studs: React.ReactElement[] = [];
  for (let x = x0 + studPitch; x < x0 + w - 1; x += studPitch) {
    studs.push(<line key={`st${x}`} x1={x} y1={eave + 4} x2={x} y2={base - 2}
      stroke={STRUCT} strokeWidth={0.5} opacity={0.55} />);
  }
  // Top plate (2/90×45) + bottom plate
  const plates = (
    <g pointerEvents="none">
      <rect x={x0} y={eave} width={w} height={3} fill={STRUCT} opacity={0.7} />
      <rect x={x0} y={base - 3} width={w} height={3} fill={STRUCT} opacity={0.7} />
    </g>
  );
  // Roof structure — truss / rafter members
  const roofStruct: React.ReactElement[] = [];
  if (S.roof !== "Flat" && cut === "cross" && S.roof !== "Mono") {
    // Show 3 trusses (front, mid, back) as overlay
    roofStruct.push(
      <g key="truss" pointerEvents="none">
        {/* bottom chord */}
        <line x1={x0} y1={eave} x2={x0 + w} y2={eave} stroke={STRUCT} strokeWidth={1.4} />
        {/* top chords */}
        <line x1={x0} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke={STRUCT} strokeWidth={1.4} />
        <line x1={x0 + w} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke={STRUCT} strokeWidth={1.4} />
        {/* king post + webs */}
        <line x1={x0 + w / 2} y1={eave} x2={x0 + w / 2} y2={eave - apexP} stroke={STRUCT} strokeWidth={1} />
        <line x1={x0 + w * 0.25} y1={eave} x2={x0 + w / 2} y2={eave - apexP * 0.5} stroke={STRUCT} strokeWidth={0.8} />
        <line x1={x0 + w * 0.75} y1={eave} x2={x0 + w / 2} y2={eave - apexP * 0.5} stroke={STRUCT} strokeWidth={0.8} />
      </g>
    );
  } else if (S.roof !== "Flat" && cut === "long") {
    // longitudinal — show truss elevations every 900mm
    const tspx = 900 * sc;
    for (let x = x0 + tspx, i = 0; x < x0 + w; x += tspx, i++) {
      roofStruct.push(
        <line key={`tl${i}`} x1={x} y1={eave} x2={x} y2={eave - apexP * 0.18}
          stroke={STRUCT} strokeWidth={0.8} />
      );
    }
  }

  // ── INSULATION HATCH ─────────────────────────────────────────────────────
  const Rv = rValues(S.insul);
  const insulWalls = Rv.wall !== "—";
  const insulCeil = Rv.ceiling !== "—";
  const insulHatch: React.ReactElement[] = [];
  if (insulWalls) {
    // crosshatch inside both cut walls
    [x0 + 0.4, x0 + w - wallT + 0.4].forEach((xw, k) => {
      for (let y = eave + 4; y < base - 4; y += 4) {
        insulHatch.push(<line key={`iw${k}-${y}`} x1={xw} y1={y} x2={xw + wallT - 1} y2={y + 3}
          stroke={INSUL} strokeWidth={0.5} opacity={0.7} />);
      }
    });
  }
  if (insulCeil && S.roof !== "Flat" && cut === "cross") {
    // batt fill between top chord and bottom chord
    for (let x = x0 + 6; x < x0 + w - 6; x += 6) {
      const dy = (Math.abs(x - (x0 + w / 2)) / (w / 2)) * apexP;
      insulHatch.push(<line key={`ic${x}`} x1={x} y1={eave - 2} x2={x} y2={eave - 2 - (apexP - dy) * 0.6}
        stroke={INSUL} strokeWidth={0.6} opacity={0.55} />);
    }
  } else if (insulCeil) {
    for (let x = x0 + 6; x < x0 + w - 6; x += 6) {
      insulHatch.push(<line key={`ic${x}`} x1={x} y1={eave - 2} x2={x} y2={eave - 8}
        stroke={INSUL} strokeWidth={0.6} opacity={0.55} />);
    }
  }

  // ── DATUM BUBBLE ─────────────────────────────────────────────────────────
  const Datum = ({ x, y, label, value, side }: { x: number; y: number; label: string; value: string; side: "left" | "right" }) => {
    const d = side === "left" ? -1 : 1;
    return (
      <g pointerEvents="none">
        <line x1={x} y1={y} x2={x + 18 * d} y2={y} stroke={DATUM} strokeWidth={0.6} />
        <circle cx={x + 22 * d} cy={y} r={9} fill="#fbf9f3" stroke={DATUM} strokeWidth={0.8} />
        <text x={x + 22 * d} y={y - 1} fill={DATUM} fontSize={6.5} fontFamily={MONO} textAnchor="middle">{label}</text>
        <text x={x + 22 * d} y={y + 7} fill={DATUM} fontSize={6} fontFamily={MONO} textAnchor="middle">{value}</text>
      </g>
    );
  };

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        {/* ground, slab, thickened edges */}
        <line x1={x0 - 40} y1={base} x2={x0 + w + 40} y2={base} stroke={INK} strokeWidth={1.4} />
        <rect x={x0} y={base} width={w} height={slabT * sc} fill="#efeadd" stroke={INK} strokeWidth={1.1}
          data-node-id="slab" data-node-type="Slab" />
        {[[x0, 1], [x0 + w, -1]].map(([xe, d], i) => (
          <rect key={i} x={d > 0 ? xe : xe - 14} y={base} width={14} height={(slabT + footing) * sc}
            fill="#efeadd" stroke={INK} strokeWidth={1.1} />
        ))}
        {earthHatch}

        {/* walls (cut) */}
        <rect x={x0} y={eave} width={wallT} height={eh} fill={INK} fillOpacity={0.82}
          data-node-id={`wall-${cut === "cross" ? "W" : "S"}`} data-node-type="Wall" />
        <rect x={x0 + w - wallT} y={eave} width={wallT} height={eh} fill={INK} fillOpacity={0.82}
          data-node-id={`wall-${cut === "cross" ? "E" : "N"}`} data-node-type="Wall" />
        <line x1={x0} y1={eave} x2={x0 + w} y2={eave} stroke="#8a7c5e" strokeWidth={1.1} />
        <line x1={x0} y1={eave + 4} x2={x0 + w} y2={eave + 4} stroke="#8a7c5e" strokeWidth={0.7} />

        {/* intermediate floor band (2-storey) */}
        {firstFloorY !== null && (
          <g pointerEvents="none">
            <rect x={x0} y={firstFloorY - 3} width={w} height={6} fill="#c9a84c" fillOpacity={0.35} stroke="#7a4a16" strokeWidth={0.8} />
            <line x1={x0 - 6} y1={firstFloorY} x2={x0 + w + 6} y2={firstFloorY} stroke="#7a4a16" strokeWidth={0.6} strokeDasharray="4 2" />
            <text x={x0 + w + 10} y={firstFloorY + 2} fill="#7a4a16" fontSize={7} fontFamily={MONO}>1st floor</text>
          </g>
        )}

        {/* roof envelope */}
        <polyline points={rpts.map((p) => p.join(",")).join(" ")} fill="#efeadd" stroke={INK} strokeWidth={1.2}
          data-node-id="roof" data-node-type="RoofSystem" />
        {ridgeLine && (
          <line x1={x0 - eaveOff} y1={ridgeLine.y} x2={x0 + w + eaveOff} y2={ridgeLine.y}
            stroke={INK} strokeWidth={0.9} strokeDasharray="6 3" />
        )}

        {/* insulation hatch (under structure overlay) */}
        {insulHatch}

        {/* structure overlay */}
        {plates}
        {studs}
        {roofStruct}

        {/* parallel-wall openings projected behind (dashed ghost) */}
        {parallelOps.map((o) => {
          const fr = openFrac(S, o);
          const owid = Math.min(o.width, widmm * 0.92) * sc;
          const cxp = x0 + Math.max(owid / 2 + wallT, Math.min(w - owid / 2 - wallT, fr * w));
          const oh = openingOH(o, S.studH) * sc;
          const sill = openingSill(o) * sc;
          return (
            <rect key={`p${o.id}`} x={cxp - owid / 2} y={base - sill - oh} width={owid} height={oh}
              fill="#fbf9f3" stroke={KIND_COL[o.kind]} strokeWidth={1} strokeDasharray="5 3" opacity={0.7}
              data-node-id={`opening-${o.id}`} data-node-type="Opening" />
          );
        })}
        {/* sectioned-through openings on end walls (solid) */}
        {cutThroughOps.map((o) => {
          const oh = openingOH(o, S.studH) * sc;
          const sill = openingSill(o) * sc;
          // place at near end wall on left
          const cxp = x0 + wallT / 2;
          return (
            <g key={`c${o.id}`}>
              <rect x={cxp - 2} y={base - sill - oh} width={4} height={oh}
                fill="#fbf9f3" stroke={KIND_COL[o.kind]} strokeWidth={1.2}
                data-node-id={`opening-${o.id}`} data-node-type="Opening" />
            </g>
          );
        })}

        {/* dimensions — right side */}
        <g pointerEvents="none">
          <line x1={x0 + w + 44} y1={base} x2={x0 + w + 44} y2={eave} stroke="#7a6f57" strokeWidth={0.5} />
          <line x1={x0 + w + 41} y1={base} x2={x0 + w + 47} y2={base} stroke="#7a6f57" strokeWidth={0.5} />
          <line x1={x0 + w + 41} y1={eave} x2={x0 + w + 47} y2={eave} stroke="#7a6f57" strokeWidth={0.5} />
          <text x={x0 + w + 50} y={(base + eave) / 2} fill={DATUM} fontSize={9} fontFamily={MONO}>
            {wallH} wall
          </text>
          {firstFloorY !== null && (
            <g>
              <line x1={x0 + w + 44} y1={base} x2={x0 + w + 44} y2={firstFloorY} stroke="#7a6f57" strokeWidth={0.5} />
              <line x1={x0 + w + 41} y1={firstFloorY} x2={x0 + w + 47} y2={firstFloorY} stroke="#7a6f57" strokeWidth={0.5} />
              <text x={x0 + w + 50} y={(base + firstFloorY) / 2} fill={DATUM} fontSize={8} fontFamily={MONO}>{S.studH} GF</text>
            </g>
          )}
          {S.roof !== "Flat" && (
            <g>
              <line x1={x0 + w + 44} y1={eave} x2={x0 + w + 44} y2={eave - apexP} stroke="#7a6f57" strokeWidth={0.5} />
              <line x1={x0 + w + 41} y1={eave - apexP} x2={x0 + w + 47} y2={eave - apexP} stroke="#7a6f57" strokeWidth={0.5} />
              <text x={x0 + w + 50} y={(eave + eave - apexP) / 2} fill={DATUM} fontSize={9} fontFamily={MONO}>
                {Math.round(apexmm)} rise
              </text>
            </g>
          )}
        </g>

        {/* FFL + stud-top datums — both margins */}
        <Datum x={x0} y={base} label="FFL" value="0" side="left" />
        <Datum x={x0 + w} y={base} label="FFL" value="0" side="right" />
        <Datum x={x0} y={eave} label="STUD" value={`+${wallH}`} side="left" />
        <Datum x={x0 + w} y={eave} label="STUD" value={`+${wallH}`} side="right" />
        {firstFloorY !== null && (
          <>
            <Datum x={x0} y={firstFloorY} label="1FL" value={`+${S.studH}`} side="left" />
            <Datum x={x0 + w} y={firstFloorY} label="1FL" value={`+${S.studH}`} side="right" />
          </>
        )}
        {S.roof !== "Flat" && (
          <>
            <Datum x={x0 + w / 2} y={eave - apexP} label="APEX" value={`+${wallH + Math.round(apexmm)}`} side="right" />
          </>
        )}

        {/* INSULATION R-VALUE SCHEDULE */}
        <g transform={`translate(${x0 - 60} ${eave - 70})`} pointerEvents="none">
          <rect x={-2} y={-12} width={130} height={62} fill="#fbf9f3" stroke="#cfc6b4" strokeWidth={0.7} rx={3} opacity={0.96} />
          <text x={0} y={-2} fill="#3c4a47" fontSize={7.5} fontFamily={MONO} letterSpacing="0.1em">INSULATION · {S.insul.toUpperCase()}</text>
          <line x1={-2} y1={2} x2={128} y2={2} stroke="#cfc6b4" strokeWidth={0.4} />
          {[["Walls", Rv.wall], ["Ceiling", Rv.ceiling], ["Floor", Rv.floor]].map(([lab, val], i) => (
            <g key={lab} transform={`translate(0 ${12 + i * 12})`}>
              <text x={0} y={0} fill={INK} fontSize={8.5} fontFamily={MONO}>{lab}</text>
              <text x={126} y={0} fill={Rv.wall === "—" && i === 0 ? "#b4472d" : INK}
                fontSize={8.5} fontFamily={MONO} textAnchor="end" fontWeight={600}>{val}</text>
            </g>
          ))}
        </g>

        {/* title strip */}
        <text x={x0 + w / 2} y={base + (footing * sc) + 22} fill={DATUM} fontSize={11}
          fontFamily={MONO} textAnchor="middle">
          SECTION {tag}–{tag} · {cut === "cross" ? "across width" : "along length"} · cut @ {cutAtMM}mm · {S.roof} {S.pitch}°
        </text>
        <text x={x0 + w / 2} y={base + (footing * sc) + 36} fill="#7a6f57" fontSize={8.5}
          fontFamily={MONO} textAnchor="middle">
          {S.struct} · {S.cover} · ochre overlay = structure · gold hatch = insulation
        </text>

        <SectionCallouts x0={x0} w={w} base={base} eave={eave} apex={eave - apexP} />
        <SheetFrame />
      </svg>
      <ScaleChip label={`section ${tag}–${tag} · ${cut === "cross" ? "cross (across width)" : "longitudinal (along length)"} · cut @ ${cutAtMM}mm · indicative`} />
    </ClickLayer>
  );
}
