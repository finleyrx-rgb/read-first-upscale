// Project Astral — paper-space sheet frame + title block.
// Renders as an inline SVG group that sits inside each view's SVG so it shares
// the standard viewBox (-14 -14 628 540). Ported from drawSheetFrame() and
// drawTitleBlock() in public/astral.html.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import { useMemo } from "react";
import { buildModel } from "@/lib/astral/model";
import { SHEET_GEO, getSheetMeta, PROJECT, wrapWords } from "@/lib/astral/sheet";

const INK = "#1d2a2a";
const LINE = "#cfc6b4";

type TProps = {
  x: number;
  y: number;
  t: string;
  s?: number;
  c?: string;
  f?: string;
  a?: "start" | "middle" | "end";
  w?: number;
};
function T({ x, y, t, s = 9, c = INK, f = "IBM Plex Mono", a = "start", w }: TProps) {
  return (
    <text x={x} y={y} fill={c} fontSize={s} fontFamily={f} textAnchor={a} fontWeight={w}>
      {t}
    </text>
  );
}

export function SheetFrame() {
  const S = useAstral(useShallow((s) => s));
  const detailFor = S.detailFor;

  const detailType = useMemo(() => {
    if (S.view !== "detail" || !detailFor) return undefined;
    const M = buildModel(S);
    return M.byId[detailFor]?.type;
    // Only re-derive when the inputs that actually feed buildModel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    S.view,
    detailFor,
    S.type,
    S.L,
    S.W,
    S.studH,
    S.spacing,
    S.roof,
    S.pitch,
    S.cover,
    S.struct,
    S.found,
    S.units,
    S.parapet,
    S.storeys,
    S.subfloor,
    S.floorDepth,
    S.wallTypes,
    S.openings,
    S.parts,
  ]);

  const meta = useMemo(() => getSheetMeta(S, detailType), [S, detailType]);

  const G = SHEET_GEO;
  const C = G.cols;
  const hot = meta.wind === "Extra High" || meta.wind === "Cyclonic (SED)";

  // Title wrap
  let titleLines = wrapWords(meta.title, 16);
  let titleSize = 12;
  if (titleLines.length > 2) {
    titleLines = wrapWords(meta.title, 22);
    titleSize = 9.5;
  }
  const ty0 = titleLines.length > 1 ? 485 : 490;

  return (
    <g pointerEvents="none" aria-hidden>
      {/* outer trim edge */}
      <rect
        x={G.paper.x}
        y={G.paper.y}
        width={G.paper.w}
        height={G.paper.h}
        fill="none"
        stroke="#d8cfbc"
        strokeWidth={0.6}
      />
      {/* doubled inner field rule (top + sides only, stops at title block) */}
      <path
        d={`M -2 ${G.tbTop} L -2 -2 L 602 -2 L 602 ${G.tbTop}`}
        fill="none"
        stroke={LINE}
        strokeWidth={0.5}
      />
      {/* corner registration ticks */}
      {(
        [
          [-6, -6, 1, 1],
          [606, -6, -1, 1],
          [-6, 516, 1, -1],
          [606, 516, -1, -1],
        ] as const
      ).map(([x, y, sx, sy], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x + 6 * sx} y2={y} stroke="#d8cfbc" strokeWidth={0.6} />
          <line x1={x} y1={y} x2={x} y2={y + 6 * sy} stroke="#d8cfbc" strokeWidth={0.6} />
        </g>
      ))}
      {/* title-block field (covers drafting grid so text reads clean) */}
      <rect
        x={G.frame.x}
        y={G.tbTop}
        width={G.frame.w}
        height={G.bottom - G.tbTop}
        fill="#fbf9f3"
      />
      <line x1={G.frame.x} y1={G.tbTop} x2={606} y2={G.tbTop} stroke={INK} strokeWidth={1} />
      <line x1={G.frame.x} y1={G.metaBot} x2={606} y2={G.metaBot} stroke={INK} strokeWidth={0.6} />
      {/* metadata strip dividers */}
      {G.metaDiv.map((x) => (
        <line key={x} x1={x} y1={G.tbTop} x2={x} y2={G.metaBot} stroke={INK} strokeWidth={0.45} />
      ))}
      {/* main block columns */}
      {[C[1], C[2], C[3], C[4]].map((x) => (
        <line key={x} x1={x} y1={G.metaBot} x2={x} y2={G.bottom} stroke={INK} strokeWidth={0.6} />
      ))}
      {/* sheet-number cell sub-rule */}
      <line x1={C[4]} y1={G.revY} x2={C[5]} y2={G.revY} stroke={INK} strokeWidth={0.45} />
      {/* heavy outer border last */}
      <rect
        x={G.frame.x}
        y={G.frame.y}
        width={G.frame.w}
        height={G.frame.h}
        fill="none"
        stroke={INK}
        strokeWidth={1.4}
      />

      {/* ---- TITLE BLOCK TEXT ---- */}
      {/* metadata strip */}
      <T x={C[0] + 8} y={455} t="PROJECT ASTRAL · SPATIAL CONSTRUCTION SET" s={7} c="#7a6f57" />
      <T
        x={G.metaDiv[0] + 8}
        y={455}
        t={`${meta.series} SERIES · ${meta.number}`}
        s={7}
        c="#7a6f57"
      />
      <T
        x={G.metaDiv[1] + 8}
        y={455}
        t={`REV ${meta.rev} · ISSUED ${meta.date}`}
        s={7}
        c="#9a8f78"
      />
      {/* col 0 — identity */}
      <T x={C[0] + 8} y={479} t="PROJECT ASTRAL" s={14} f="Fraunces" w={700} />
      <T x={C[0] + 8} y={492} t={PROJECT.tagline} s={7.5} c="#7a6f57" />
      <T x={C[0] + 8} y={503} t={PROJECT.consent} s={7.5} c="#bf6b2c" />
      <T x={C[0] + 8} y={512} t={S.sourceElaborated ? "elaborated from source plan — review against original" : "concept / indicative — not for construction"} s={6.5} c="#9a8f78" />
      {/* col 1 — project */}
      <T x={C[1] + 8} y={470} t="PROJECT" s={7} c="#9a8f78" />
      <T
        x={C[1] + 8}
        y={486}
        t={`${meta.project.toUpperCase()} — ${meta.location.toUpperCase()}`}
        s={10}
      />
      <T x={C[1] + 8} y={499} t={meta.dims} s={7.5} c="#3c4a47" />
      <T
        x={C[1] + 8}
        y={511}
        t={`WIND ZONE — ${meta.wind.toUpperCase()}`}
        s={7.5}
        c={hot ? "#bf6b2c" : "#3c4a47"}
      />
      {/* col 2 — drawing */}
      <T x={C[2] + 8} y={470} t="DRAWING" s={7} c="#9a8f78" />
      {titleLines.map((ln, i) => (
        <T key={i} x={C[2] + 8} y={ty0 + i * 12} t={ln} s={titleSize} f="Fraunces" w={600} />
      ))}
      {meta.sub && <T x={C[2] + 8} y={509} t={meta.sub} s={7.5} c="#bf6b2c" />}
      {/* col 3 — issue */}
      <T x={C[3] + 8} y={470} t="DATE" s={7} c="#9a8f78" />
      <T x={C[3] + 8} y={481} t={meta.date} s={8.5} />
      <T x={C[3] + 8} y={494} t="SCALE" s={7} c="#9a8f78" />
      <T x={C[3] + 8} y={505} t={meta.scale} s={9} />
      <T x={C[3] + 8} y={513} t={meta.scaleNote} s={7} c="#7a6f57" />
      {/* col 4 — status / rev / sheet number */}
      <T x={C[4] + 8} y={470} t="STATUS" s={7} c="#9a8f78" />
      <T x={C[4] + 8} y={481} t={meta.status} s={8.5} c="#bf6b2c" />
      <T x={C[5] - 8} y={481} t={`REV ${meta.rev}`} s={8.5} a="end" c="#3c4a47" />
      <T x={C[4] + 8} y={498} t="SHEET" s={7} c="#9a8f78" />
      <T x={C[4] + 8} y={513} t={meta.number} s={17} f="Fraunces" w={700} />
    </g>
  );
}
