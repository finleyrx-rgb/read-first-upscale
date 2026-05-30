// Project Astral — paper-space sheet metadata.
// Ported from public/astral.html (SHEETS / SHEET_SERIES / SHEET_INDEX / getSheetMeta).
// One concept-construction-set sheet per (view, layer, face/cut/detail) combo, with
// deterministic auto-numbering in its A-series (A0/A1/A2/A3/A5).

import type { AstralState } from "./store";

export const PROJECT = {
  firm: "PROJECT ASTRAL",
  tagline: "spatial construction set",
  consent: "BUILDING CONSENT",
  location: "Wanaka NZ",
  paper: "A1",
  status: "CONCEPT",
  rev: "P1",
  // Deterministic issue date — must not depend on `new Date()` so SSR and client agree.
  date: "30/05/2026",
} as const;

export const COMPASS = {
  front: "South",
  back: "North",
  left: "West",
  right: "East",
} as const;

export const SHEET_SERIES: Record<string, string> = {
  A0: "Register",
  A1: "Plans",
  A2: "Elevations",
  A3: "Sections",
  A4: "Schedules",
  A5: "Details",
};

type SheetDef = { prefix: string; title: string; scale: string; byFace?: boolean };

export const SHEETS: Record<string, SheetDef> = {
  cover:                { prefix: "A0", title: "Drawing Register",       scale: "NTS" },
  plan_arch:            { prefix: "A1", title: "Floor Plan",             scale: "1:100" },
  plan_foundation:      { prefix: "A1", title: "Foundation Plan",        scale: "1:100" },
  plan_framing:         { prefix: "A1", title: "Framing Plan",           scale: "1:100" },
  elevation_arch:       { prefix: "A2", title: "Elevation",              scale: "1:100", byFace: true },
  elevation_foundation: { prefix: "A2", title: "Concrete Elevation",     scale: "1:100", byFace: true },
  elevation_framing:    { prefix: "A2", title: "Framing Elevation",      scale: "1:50",  byFace: true },
  section_cross:        { prefix: "A3", title: "Cross Section",          scale: "1:50" },
  section_long:         { prefix: "A3", title: "Longitudinal Section",   scale: "1:50" },
  detail_wall:          { prefix: "A5", title: "Wall Framing Detail",    scale: "1:5" },
  detail_roof:          { prefix: "A5", title: "Eave Detail",            scale: "1:10" },
  detail_slab:          { prefix: "A5", title: "Slab Edge Detail",       scale: "1:5" },
  detail_opening:       { prefix: "A5", title: "Lintel / Head Detail",   scale: "1:5" },
};

const SHEET_FACES = ["front", "back", "left", "right"] as const;

function buildSheetIndex(): Record<string, { prefix: string; seq: number }> {
  const ctr: Record<string, number> = {};
  const idx: Record<string, { prefix: string; seq: number }> = {};
  for (const key of Object.keys(SHEETS)) {
    const def = SHEETS[key];
    const assign = (id: string) => {
      ctr[def.prefix] = (ctr[def.prefix] || 0) + 1;
      idx[id] = { prefix: def.prefix, seq: ctr[def.prefix] };
    };
    if (def.byFace) for (const f of SHEET_FACES) assign(`${key}@${f}`);
    else assign(key);
  }
  return idx;
}
export const SHEET_INDEX = buildSheetIndex();

export type SheetMeta = {
  key: string;
  number: string;
  series: string;
  title: string;
  sub: string;
  scale: string;
  scaleNote: string;
  project: string;
  location: string;
  wind: string;
  dims: string;
  date: string;
  status: string;
  rev: string;
};

export function getSheetMeta(S: AstralState, detailType?: string): SheetMeta {
  let key: string;
  let face: string | undefined;
  let generic = false;

  if (S.view === "plan") {
    key = S.layer === "framing" ? "plan_framing"
      : S.layer === "foundation" ? "plan_foundation"
      : "plan_arch";
  } else if (S.view === "elevation") {
    key = S.layer === "framing" ? "elevation_framing"
      : S.layer === "foundation" ? "elevation_foundation"
      : "elevation_arch";
    face = S.face;
  } else if (S.view === "section") {
    key = S.cut === "long" ? "section_long" : "section_cross";
  } else {
    if (!detailType) { key = "detail_wall"; generic = true; }
    else if (detailType === "RoofSystem") key = "detail_roof";
    else if (detailType === "Slab") key = "detail_slab";
    else if (detailType === "Opening") key = "detail_opening";
    else key = "detail_wall";
  }

  const def = SHEETS[key] || SHEETS.plan_arch;
  const refId = def.byFace ? `${key}@${face || "front"}` : key;
  const ix = SHEET_INDEX[refId] || { prefix: def.prefix, seq: 1 };
  const number = `${ix.prefix}.${String(ix.seq).padStart(2, "0")}`;

  let title = def.title;
  let sub = "";
  if (def.byFace) {
    const c = COMPASS[(face || "front") as keyof typeof COMPASS] || "South";
    title = def.title === "Elevation" ? `${c} Elevation` : `${c} ${def.title}`;
    sub = c;
  } else if (generic) {
    title = "Construction Detail";
  } else if (key.startsWith("detail_")) {
    sub = def.title.replace(/ Detail$/, "");
  }

  return {
    key,
    number,
    series: (SHEET_SERIES[ix.prefix] || "").toUpperCase(),
    title: title.toUpperCase(),
    sub: sub.toUpperCase(),
    scale: def.scale,
    scaleNote: `${def.scale} @ ${PROJECT.paper}`,
    project: S.type || "Building",
    location: PROJECT.location,
    wind: S.wind,
    dims: `${(S.L / 1000).toFixed(1)} × ${(S.W / 1000).toFixed(1)} m`,
    date: PROJECT.date,
    status: PROJECT.status,
    rev: PROJECT.rev,
  };
}

// Paper-space geometry (matches SHEET_GEO in the legacy HTML).
export const SHEET_GEO = {
  paper: { x: -12, y: -12, w: 624, h: 534 },
  frame: { x: -6, y: -6, w: 612, h: 522 },
  tbTop: 442,
  metaBot: 460,
  bottom: 516,
  cols: [-6, 152, 300, 410, 502, 606],
  metaDiv: [300, 470],
  revY: 486,
};

export function wrapWords(str: string, max: number): string[] {
  const words = str.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) out.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}
