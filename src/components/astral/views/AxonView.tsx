// Axonometric / 3D view (§7.11) — pure SVG isometric projection of the live
// model. Same source of truth as plan/elev/section; just another projection.
// No Three.js bundle — keeps SSR + Worker happy and matches the drawing-set
// aesthetic. Renders ground plane, foundation (slab or piles), each storey
// box with cladding hue, openings cut into walls, and a roof prism.

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAstral } from "@/lib/astral/store";
import { cladHex, roofHex, wallLen } from "@/lib/astral/geom";
import { ClickLayer } from "./ClickLayer";
import { ScaleChip } from "./PlanView";
import { SheetFrame } from "../SheetFrame";

const VW = 600,
  VH = 440;
const INK = "#1d2a2a";
const MONO = "IBM Plex Mono";

// Iso projection: x_screen = (x - y) * cos30, y_screen = (x + y) * sin30 - z
const C30 = Math.cos(Math.PI / 6);
const S30 = Math.sin(Math.PI / 6);
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * C30, (x + y) * S30 - z];
}

function shade(hex: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * k)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * k)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * k)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function AxonView() {
  const S = useAstral(
    useShallow((s) => ({
      L: s.L,
      W: s.W,
      studH: s.studH,
      storeys: s.storeys,
      floorDepth: s.floorDepth,
      found: s.found,
      subfloor: s.subfloor,
      roof: s.roof,
      pitch: s.pitch,
      clad: s.clad,
      cladCol: s.cladCol,
      roofCol: s.roofCol,
      openings: s.openings,
      eave: s.eave,
      units: s.units,
    })),
  );

  const view = useMemo(() => {
    const L = S.L,
      W = S.W;
    const piles = S.found === "Timber piles";
    const groundZ = piles ? S.subfloor : 0; // top of slab / floor
    const floorH = piles ? 0 : 100; // slab thickness (mm)
    const storeyH = S.studH;
    const interH = S.floorDepth; // floor build between storeys
    const totalH = groundZ + floorH + storeyH * S.storeys + interH * (S.storeys - 1);
    const apexH = S.roof === "Flat" ? 200 : (W / 2) * Math.tan((S.pitch * Math.PI) / 180);

    // collect all iso points so we can frame the drawing
    const corners: [number, number, number][] = [
      [0, 0, 0],
      [L, 0, 0],
      [L, W, 0],
      [0, W, 0],
      [0, 0, totalH + apexH],
      [L, 0, totalH + apexH],
      [L, W, totalH + apexH],
      [0, W, totalH + apexH],
    ];
    const pts = corners.map(([x, y, z]) => iso(x, y, z));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const pad = 60;
    const sc = Math.min((VW - 2 * pad) / (maxX - minX), (VH - 2 * pad) / (maxY - minY));
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    const P = (x: number, y: number, z: number) => {
      const [ix, iy] = iso(x, y, z);
      return [VW / 2 + (ix - cx) * sc, VH / 2 + (iy - cy) * sc] as const;
    };

    return { L, W, piles, groundZ, floorH, storeyH, interH, totalH, apexH, P, sc };
  }, [S]);

  const { L, W, piles, groundZ, floorH, storeyH, interH, totalH, apexH, P } = view;
  const cladTop = cladHex(S.cladCol);
  const cladLeft = shade(cladTop, 0.82);
  const cladRight = shade(cladTop, 0.92);
  const roofC = roofHex(S.roofCol);

  // Ground plane (large rectangle around footprint, faint)
  const gPad = Math.max(L, W) * 0.4;
  const gp = [
    P(-gPad, -gPad, 0),
    P(L + gPad, -gPad, 0),
    P(L + gPad, W + gPad, 0),
    P(-gPad, W + gPad, 0),
  ];

  // Foundation
  const foundation: React.ReactElement[] = [];
  if (piles) {
    // pile grid heads + bearer hint
    const stepX = L / Math.max(2, Math.round(L / 1800));
    const stepY = W / Math.max(2, Math.round(W / 1800));
    for (let x = 0; x <= L + 1; x += stepX) {
      for (let y = 0; y <= W + 1; y += stepY) {
        const a = P(x - 90, y - 90, 0),
          b = P(x + 90, y - 90, 0);
        const c = P(x + 90, y + 90, 0),
          d = P(x - 90, y + 90, 0);
        const at = P(x - 90, y - 90, groundZ),
          bt = P(x + 90, y - 90, groundZ);
        const ct = P(x + 90, y + 90, groundZ),
          dt = P(x - 90, y + 90, groundZ);
        foundation.push(
          <g key={`pile${x}-${y}`} pointerEvents="none">
            <polygon
              points={`${at[0]},${at[1]} ${bt[0]},${bt[1]} ${ct[0]},${ct[1]} ${dt[0]},${dt[1]}`}
              fill="#cdbf9f"
              stroke={INK}
              strokeWidth={0.4}
            />
            <polygon
              points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${bt[0]},${bt[1]} ${at[0]},${at[1]}`}
              fill={shade("#cdbf9f", 0.78)}
              stroke={INK}
              strokeWidth={0.3}
            />
            <polygon
              points={`${b[0]},${b[1]} ${c[0]},${c[1]} ${ct[0]},${ct[1]} ${bt[0]},${bt[1]}`}
              fill={shade("#cdbf9f", 0.88)}
              stroke={INK}
              strokeWidth={0.3}
            />
          </g>,
        );
      }
    }
  } else {
    // slab block
    const z0 = -150,
      z1 = floorH; // 150mm embedment hint
    const top = [P(0, 0, z1), P(L, 0, z1), P(L, W, z1), P(0, W, z1)];
    const frontA = P(0, 0, z0),
      frontB = P(L, 0, z0);
    const rightA = P(L, W, z0);
    foundation.push(
      <g key="slab" pointerEvents="none">
        <polygon
          points={`${frontA[0]},${frontA[1]} ${frontB[0]},${frontB[1]} ${top[1][0]},${top[1][1]} ${top[0][0]},${top[0][1]}`}
          fill={shade("#efeadd", 0.82)}
          stroke={INK}
          strokeWidth={0.6}
        />
        <polygon
          points={`${frontB[0]},${frontB[1]} ${rightA[0]},${rightA[1]} ${top[2][0]},${top[2][1]} ${top[1][0]},${top[1][1]}`}
          fill={shade("#efeadd", 0.9)}
          stroke={INK}
          strokeWidth={0.6}
        />
        <polygon
          points={`${top[0][0]},${top[0][1]} ${top[1][0]},${top[1][1]} ${top[2][0]},${top[2][1]} ${top[3][0]},${top[3][1]}`}
          fill="#efeadd"
          stroke={INK}
          strokeWidth={0.6}
        />
      </g>,
    );
  }

  // Storey boxes
  const storeyFaces: React.ReactElement[] = [];
  for (let s = 0; s < S.storeys; s++) {
    const z0 = groundZ + floorH + s * (storeyH + interH);
    const z1 = z0 + storeyH;

    // four walls — but cut openings by drawing rects on the wall plane
    const corners = {
      A: P(0, 0, z0),
      B: P(L, 0, z0),
      C: P(L, W, z0),
      D: P(0, W, z0),
      At: P(0, 0, z1),
      Bt: P(L, 0, z1),
      Ct: P(L, W, z1),
      Dt: P(0, W, z1),
    };
    // front (y=0) — visible
    storeyFaces.push(
      <polygon
        key={`fr${s}`}
        data-node-id="bldg"
        data-node-type="Building"
        points={`${corners.A[0]},${corners.A[1]} ${corners.B[0]},${corners.B[1]} ${corners.Bt[0]},${corners.Bt[1]} ${corners.At[0]},${corners.At[1]}`}
        fill={cladLeft}
        stroke={INK}
        strokeWidth={0.7}
      />,
    );
    // right (x=L) — visible
    storeyFaces.push(
      <polygon
        key={`rt${s}`}
        points={`${corners.B[0]},${corners.B[1]} ${corners.C[0]},${corners.C[1]} ${corners.Ct[0]},${corners.Ct[1]} ${corners.Bt[0]},${corners.Bt[1]}`}
        fill={cladRight}
        stroke={INK}
        strokeWidth={0.7}
      />,
    );
    // top (roof underside / floor of storey above) — only show on top storey if flat-ish
    if (s === S.storeys - 1 && S.roof === "Flat") {
      storeyFaces.push(
        <polygon
          key={`tp${s}`}
          points={`${corners.At[0]},${corners.At[1]} ${corners.Bt[0]},${corners.Bt[1]} ${corners.Ct[0]},${corners.Ct[1]} ${corners.Dt[0]},${corners.Dt[1]}`}
          fill={roofC}
          stroke={INK}
          strokeWidth={0.7}
        />,
      );
    }

    // Openings on S (front, y=0) and W (left, x=0 — hidden) and E (right, x=L) and N (back, y=W — hidden).
    // Only first storey shows ground-floor openings; upper storeys get simple stacked windows.
    const sourceOps = s === 0 ? S.openings : S.openings.filter((o) => o.kind === "Window");
    sourceOps.forEach((o, idx) => {
      const wl = wallLen({ L, W }, o.wall);
      const ow = Math.min(o.width, wl * 0.9);
      const headH =
        o.head ??
        (o.kind === "Garage" ? Math.min(storeyH - 200, 2400) : o.kind === "Door" ? 1980 : 2000);
      const sillH = o.sill ?? (o.kind === "Window" ? 900 : 0);
      const oh = Math.max(200, headH - sillH);
      const oz0 = z0 + sillH;
      const oz1 = oz0 + oh;
      const off = o.off;
      if (o.wall === "S") {
        const p1 = P(off - ow / 2, 0, oz0),
          p2 = P(off + ow / 2, 0, oz0);
        const p3 = P(off + ow / 2, 0, oz1),
          p4 = P(off - ow / 2, 0, oz1);
        storeyFaces.push(
          <polygon
            key={`op-s${s}-${idx}`}
            points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ${p4[0]},${p4[1]}`}
            fill={o.kind === "Garage" ? "#22303a" : "#3f5560"}
            stroke={INK}
            strokeWidth={0.4}
            opacity={0.95}
            data-node-id={`opening-${o.id}`}
            data-node-type="Opening"
          />,
        );
      } else if (o.wall === "E") {
        const p1 = P(L, off - ow / 2, oz0),
          p2 = P(L, off + ow / 2, oz0);
        const p3 = P(L, off + ow / 2, oz1),
          p4 = P(L, off - ow / 2, oz1);
        storeyFaces.push(
          <polygon
            key={`op-e${s}-${idx}`}
            points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ${p4[0]},${p4[1]}`}
            fill={o.kind === "Garage" ? "#22303a" : "#3f5560"}
            stroke={INK}
            strokeWidth={0.4}
            opacity={0.95}
            data-node-id={`opening-${o.id}`}
            data-node-type="Opening"
          />,
        );
      }
    });

    // floor band between storeys (visible reveal)
    if (s < S.storeys - 1) {
      const fz0 = z1,
        fz1 = z1 + interH;
      const A = P(0, 0, fz0),
        B = P(L, 0, fz0),
        Bt = P(L, 0, fz1),
        At = P(0, 0, fz1);
      const C = P(L, W, fz0),
        Ct = P(L, W, fz1);
      storeyFaces.push(
        <g key={`fl${s}`} pointerEvents="none">
          <polygon
            points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${Bt[0]},${Bt[1]} ${At[0]},${At[1]}`}
            fill={shade(cladLeft, 0.72)}
            stroke={INK}
            strokeWidth={0.5}
          />
          <polygon
            points={`${B[0]},${B[1]} ${C[0]},${C[1]} ${Ct[0]},${Ct[1]} ${Bt[0]},${Bt[1]}`}
            fill={shade(cladRight, 0.78)}
            stroke={INK}
            strokeWidth={0.5}
          />
        </g>,
      );
    }
  }

  // Roof prism — sits on top of topmost storey unless Flat (already drawn)
  const roofShape: React.ReactElement[] = [];
  if (S.roof !== "Flat") {
    const topZ = groundZ + floorH + S.storeys * storeyH + (S.storeys - 1) * interH;
    const apex = topZ + apexH;
    if (S.roof === "Mono") {
      const A = P(0, 0, topZ),
        B = P(L, 0, topZ),
        C = P(L, W, topZ),
        D = P(0, W, topZ);
      const At = P(0, 0, apex),
        Bt = P(L, 0, apex);
      roofShape.push(
        <g key="roof" pointerEvents="none">
          <polygon
            points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${Bt[0]},${Bt[1]} ${At[0]},${At[1]}`}
            fill={shade(roofC, 1.05)}
            stroke={INK}
            strokeWidth={0.7}
          />
          <polygon
            points={`${At[0]},${At[1]} ${Bt[0]},${Bt[1]} ${C[0]},${C[1]} ${D[0]},${D[1]}`}
            fill={roofC}
            stroke={INK}
            strokeWidth={0.7}
          />
        </g>,
      );
    } else {
      // gable / hip — ridge along long axis
      const ridge0 = P(0, W / 2, apex),
        ridge1 = P(L, W / 2, apex);
      const A = P(0, 0, topZ),
        B = P(L, 0, topZ),
        C = P(L, W, topZ),
        D = P(0, W, topZ);
      roofShape.push(
        <g key="roof" pointerEvents="none">
          {/* front slope */}
          <polygon
            points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${ridge1[0]},${ridge1[1]} ${ridge0[0]},${ridge0[1]}`}
            fill={shade(roofC, 1.08)}
            stroke={INK}
            strokeWidth={0.7}
          />
          {/* right gable triangle (visible) */}
          <polygon
            points={`${B[0]},${B[1]} ${C[0]},${C[1]} ${ridge1[0]},${ridge1[1]}`}
            fill={shade(cladRight, 1.02)}
            stroke={INK}
            strokeWidth={0.7}
          />
          {/* back slope (partial visibility) */}
          <polygon
            points={`${ridge0[0]},${ridge0[1]} ${ridge1[0]},${ridge1[1]} ${C[0]},${C[1]} ${D[0]},${D[1]}`}
            fill={roofC}
            stroke={INK}
            strokeWidth={0.7}
            opacity={0.92}
          />
        </g>,
      );
    }
  }

  // North arrow
  const nA = P(-gPad * 0.6, -gPad * 0.6, 0);

  return (
    <ClickLayer>
      <svg viewBox="-14 -14 628 540" preserveAspectRatio="xMidYMid meet">
        {/* ground */}
        <polygon
          points={gp.map((p) => `${p[0]},${p[1]}`).join(" ")}
          fill="#f1ecde"
          stroke="#c8bfa3"
          strokeWidth={0.4}
          pointerEvents="none"
        />
        {/* ground grid lines (one per metre) */}
        {Array.from({ length: 9 }).map((_, i) => {
          const t = -gPad + ((i + 1) * (L + 2 * gPad)) / 10;
          const a = P(t, -gPad, 0),
            b = P(t, W + gPad, 0);
          return (
            <line
              key={`gg${i}`}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke="#d6cdb2"
              strokeWidth={0.3}
              pointerEvents="none"
            />
          );
        })}

        {foundation}
        {storeyFaces}
        {roofShape}

        {/* unit split markers along ridge */}
        {S.units > 1 &&
          S.roof !== "Flat" &&
          Array.from({ length: S.units - 1 }).map((_, i) => {
            const x = (L / S.units) * (i + 1);
            const a = P(
              x,
              W / 2,
              groundZ + floorH + storeyH * S.storeys + interH * (S.storeys - 1) + apexH,
            );
            const b = P(x, W / 2, groundZ);
            return (
              <line
                key={`pw${i}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={INK}
                strokeWidth={0.5}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
            );
          })}

        {/* north arrow */}
        <g transform={`translate(${nA[0]} ${nA[1]})`} pointerEvents="none">
          <circle r={11} fill="#fbf9f3" stroke={INK} strokeWidth={0.5} />
          <polygon points="0,-9 4,6 0,2 -4,6" fill={INK} />
          <text y={-13} fontFamily={MONO} fontSize={7} fill={INK} textAnchor="middle">
            N
          </text>
        </g>

        {/* legend */}
        <text x={VW / 2} y={26} fill="#3c4a47" fontSize={10} fontFamily={MONO} textAnchor="middle">
          AXONOMETRIC · {S.storeys}-STOREY ·{" "}
          {piles ? `TIMBER PILE FLOOR (${S.subfloor}mm subfloor)` : "CONCRETE SLAB"}
        </text>
        <text
          x={VW / 2}
          y={VH - 8}
          fill="#7a6f57"
          fontSize={8}
          fontFamily={MONO}
          textAnchor="middle"
        >
          indicative massing · same model as plan / elevation / section · not to scale
        </text>

        <SheetFrame />
      </svg>
      <ScaleChip
        label={`axonometric · ${S.storeys}-storey · ${piles ? "piled" : "slab"} · roof ${S.roof}`}
      />
    </ClickLayer>
  );
}
