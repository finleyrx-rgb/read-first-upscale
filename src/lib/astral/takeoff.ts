// Project Astral — Phase 7 §7.6/§7.7 materials takeoff + schedules.
// Walks the live model to compute real quantities. All outputs are
// **indicative** — they target NZS 3604 conventions but are not a substitute
// for a quantity surveyor or engineer.

import type { AstralState, Opening, Partition } from "./store";
import { defaultHead, defaultSill } from "./store";
import { lintelRule, studRule } from "./model";
import { WALLNAME, type WallKey } from "./constants";

// ---------- shared helpers ----------

const wallLen = (S: AstralState, w: WallKey) =>
  (w === "N" || w === "S" ? S.L : S.W);

const allWalls: readonly WallKey[] = ["N", "S", "E", "W"] as const;

/** Cladding/lining wastage allowance (10 % per §7.6). */
const WASTE = 1.1;

/** Nogging rows per wall — one mid-height row, plus an extra above ≥2700mm studs. */
function nogRows(studH: number): number {
  return studH >= 2700 ? 2 : 1;
}

// ---------- stud takeoff per wall ----------

export type StudLine = {
  wall: WallKey;
  wallName: string;
  length_mm: number;
  height_mm: number;
  spacing_mm: number;
  size: string;
  /** common studs (full-height, on the regular grid) */
  common: number;
  /** jack studs (cripples) — short studs above/under openings */
  jack: number;
  /** trimmer studs — full-height supporting the lintel each side of an opening */
  trimmer: number;
  /** corner studs — 2 per external corner shared between adjacent walls */
  corner: number;
  /** noggings — lineal metres of dwangs/blocking */
  nogs_lm: number;
  /** top + bottom plates lineal metres (2 top + 1 bottom = 3 × wall length) */
  plates_lm: number;
};

export function takeoffStuds(S: AstralState): StudLine[] {
  const size = studRule(S).v;
  return allWalls.map((w) => {
    const len = wallLen(S, w);
    const h = S.studH;
    const ops = S.openings.filter((o) => o.wall === w);

    // Common studs on the grid (one extra for the end), minus any displaced by openings.
    const grid = Math.floor(len / S.spacing) + 1;
    const displaced = ops.reduce(
      (a, o) => a + Math.max(0, Math.ceil(o.width / S.spacing) - 1),
      0,
    );
    const common = Math.max(0, grid - displaced);

    // 2 trimmers + 2 jack studs per opening (top jacks; window also has bottom cripples).
    const trimmer = ops.length * 2;
    const jack = ops.reduce((a, o) => a + (o.kind === "Window" ? 4 : 2), 0);

    // Corner studs — 2 per corner; split evenly between the four walls -> 1 per wall.
    const corner = 1;

    // Noggings: one or two horizontal rows along the wall length.
    const nogs_lm = (len / 1000) * nogRows(h);

    // Plates: 2 top + 1 bottom along the full wall.
    const plates_lm = (len / 1000) * 3;

    // Scale by number of storeys.
    const st = S.storeys;
    return {
      wall: w,
      wallName: WALLNAME[w],
      length_mm: len,
      height_mm: h,
      spacing_mm: S.spacing,
      size,
      common: common * st,
      jack: jack * st,
      trimmer: trimmer * st,
      corner: corner * st,
      nogs_lm: round2(nogs_lm * st),
      plates_lm: round2(plates_lm * st),
    };
  });
}

export type StudTotals = {
  studs_pcs: number;
  studs_lm: number;
  plates_lm: number;
  nogs_lm: number;
  size: string;
};

export function studTotals(lines: StudLine[]): StudTotals {
  const studs_pcs = lines.reduce(
    (a, l) => a + l.common + l.jack + l.trimmer + l.corner,
    0,
  );
  const plates_lm = lines.reduce((a, l) => a + l.plates_lm, 0);
  const nogs_lm = lines.reduce((a, l) => a + l.nogs_lm, 0);
  // Convert piece count to lineal metres assuming nominal stud height.
  const h_lm = lines.length > 0 ? lines[0].height_mm / 1000 : 0;
  return {
    studs_pcs,
    studs_lm: round2(studs_pcs * h_lm),
    plates_lm: round2(plates_lm),
    nogs_lm: round2(nogs_lm),
    size: lines[0]?.size ?? "",
  };
}

// ---------- openings (door/window/garage) schedule ----------

export type OpeningRow = {
  ref: string;
  kind: Opening["kind"];
  wall: WallKey;
  wallName: string;
  width_mm: number;
  height_mm: number;
  head_mm: number;
  sill_mm: number;
  off_mm: number;
  area_m2: number;
};

export function scheduleOpenings(S: AstralState): OpeningRow[] {
  let d = 0, w = 0, g = 0;
  return S.openings.map((o) => {
    const head = openingHead(o, S.studH);
    const sill = openingSill(o);
    const height = Math.max(0, head - sill);
    const tag = o.kind === "Door" ? `D${String(++d).padStart(2, "0")}`
      : o.kind === "Window" ? `W${String(++w).padStart(2, "0")}`
      : `G${String(++g).padStart(2, "0")}`;
    return {
      ref: tag,
      kind: o.kind,
      wall: o.wall,
      wallName: WALLNAME[o.wall],
      width_mm: o.width,
      height_mm: height,
      head_mm: head,
      sill_mm: sill,
      off_mm: o.off,
      area_m2: round2((o.width / 1000) * (height / 1000)),
    };
  });
}

function openingHead(o: Opening, studH: number): number {
  return o.head ?? defaultHead(o.kind, studH);
}
function openingSill(o: Opening): number {
  return o.sill ?? defaultSill(o.kind);
}

// ---------- lintel schedule (grouped by size) ----------

export type LintelRow = {
  ref: string;
  size: string;
  span_mm: number;
  count: number;
  /** length per lintel including 100mm bearing each end */
  length_per_mm: number;
  total_lm: number;
  sed: boolean;
};

export function scheduleLintels(S: AstralState): LintelRow[] {
  // Group identical spans together so the schedule is concise.
  const map = new Map<string, LintelRow>();
  S.openings.forEach((o) => {
    const r = lintelRule(o.width);
    const length_per = o.width + 200; // 100mm bearing each end
    const key = `${r.v}|${o.width}`;
    const ex = map.get(key);
    if (ex) {
      ex.count += 1;
      ex.total_lm = round2(ex.total_lm + length_per / 1000);
    } else {
      map.set(key, {
        ref: `L${map.size + 1}`,
        size: r.v,
        span_mm: o.width,
        count: 1,
        length_per_mm: length_per,
        total_lm: round2(length_per / 1000),
        sed: r.sed,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.span_mm - a.span_mm);
}

// ---------- bracing schedule (indicative BU per wall) ----------

export type BraceRow = {
  wall: WallKey;
  wallName: string;
  length_mm: number;
  /** available bracing length (wall length minus opening widths) */
  available_mm: number;
  /** number of P21-style indicative panels at 1200mm wide */
  panels: number;
  /** indicative bracing units achieved */
  bu: number;
  sed: boolean;
};

export function scheduleBracing(S: AstralState): BraceRow[] {
  const windFactor = ({
    Medium: 0.7, High: 1.0, "Very High": 1.3, "Extra High": 1.6,
    "Cyclonic (SED)": 2.0,
  } as Record<string, number>)[S.wind] ?? 1.6;
  const buPerPanel = Math.round(110 * windFactor); // P21 nominal

  return allWalls.map((w) => {
    const len = wallLen(S, w);
    const opSum = S.openings.filter((o) => o.wall === w).reduce((a, o) => a + o.width, 0);
    const available = Math.max(0, len - opSum);
    const panels = Math.max(0, Math.floor(available / 1200));
    const sed = opSum > 0.45 * len;
    return {
      wall: w,
      wallName: WALLNAME[w],
      length_mm: len,
      available_mm: available,
      panels,
      bu: panels * buPerPanel,
      sed,
    };
  });
}

// ---------- fixings ----------

export type FixingRow = { item: string; qty: number; unit: string; note: string };

export function takeoffFixings(S: AstralState): FixingRow[] {
  const perim_m = (2 * (S.L + S.W)) / 1000;
  const trusses = Math.max(2, Math.round(S.L / 900) + 1);
  const studs = takeoffStuds(S).reduce(
    (a, l) => a + l.common + l.jack + l.trimmer + l.corner,
    0,
  );
  const hi = ["High", "Very High", "Extra High", "Cyclonic (SED)"].includes(S.wind);
  const st = S.storeys;
  const rows: FixingRow[] = [
    { item: "M12 chem anchors (slab → bottom plate)", qty: Math.ceil(perim_m / 0.9) * st, unit: "ea", note: "@900 c/c" },
    { item: "Cyclone straps (truss tie-down, both ends)", qty: trusses * 2, unit: "ea", note: hi ? "high-wind" : "standard" },
    { item: "Wire dogs / skew nails (stud → plate)", qty: studs * 2, unit: "ea", note: "top + bottom" },
    { item: "Lintel hangers / brackets", qty: S.openings.length * 2 * st, unit: "ea", note: "each end" },
    { item: "Galv. flat-head nails (3.15×75)", qty: Math.ceil(perim_m * 30) * st, unit: "ea", note: "plate fixing" },
    { item: "Type 17 batten screws (cladding)", qty: Math.ceil(((2 * (S.L + S.W) * S.studH * st) / 1e6) * 12), unit: "ea", note: "≈12/m²" },
  ];
  return rows;
}

// ---------- cladding + lining areas ----------

export type AreaRow = {
  item: string;
  gross_m2: number;
  openings_m2: number;
  net_m2: number;
  waste_pct: number;
  order_m2: number;
  spec: string;
};

export function takeoffAreas(S: AstralState): AreaRow[] {
  const perim = (2 * (S.L + S.W)) / 1000;
  const h = S.studH / 1000;
  const st = S.storeys;
  const wallA = perim * h * st;
  const openA = S.openings.reduce((a, o) => {
    const head = o.head ?? defaultHead(o.kind, S.studH);
    const sill = o.sill ?? defaultSill(o.kind);
    return a + (o.width / 1000) * Math.max(0, (head - sill) / 1000);
  }, 0) * st;
  const netExt = Math.max(0, wallA - openA);
  // Internal lining = both faces of external walls (minus openings) + both faces of partitions.
  const partsA = S.parts.reduce((a, p: Partition) => a + (p.len / 1000) * h, 0);
  const liningGross = netExt + partsA * 2;

  const roofA = S.roof === "Flat"
    ? (S.L / 1000) * (S.W / 1000) * 1.05
    : ((S.L / 1000) * (S.W / 1000) / Math.cos((S.pitch * Math.PI) / 180)) * 1.06;

  const rows: AreaRow[] = [
    {
      item: "Cladding", gross_m2: round2(wallA), openings_m2: round2(openA),
      net_m2: round2(netExt), waste_pct: 10,
      order_m2: round2(netExt * WASTE), spec: S.clad,
    },
    {
      item: "Internal lining", gross_m2: round2(liningGross), openings_m2: 0,
      net_m2: round2(liningGross), waste_pct: 10,
      order_m2: round2(liningGross * WASTE), spec: S.lining,
    },
    {
      item: "Roofing", gross_m2: round2(roofA), openings_m2: 0,
      net_m2: round2(roofA), waste_pct: 5,
      order_m2: round2(roofA * 1.05), spec: `${S.cover} (${S.roofCol})`,
    },
    {
      item: "Building wrap", gross_m2: round2(wallA), openings_m2: 0,
      net_m2: round2(wallA), waste_pct: 15,
      order_m2: round2(wallA * 1.15), spec: "Self-supporting wrap",
    },
    {
      item: "Roof underlay", gross_m2: round2(roofA), openings_m2: 0,
      net_m2: round2(roofA), waste_pct: 15,
      order_m2: round2(roofA * 1.15), spec: "Synthetic underlay",
    },
  ];

  if (st === 2) {
    const floorA = (S.L / 1000) * (S.W / 1000);
    const joistLm = (S.L / 1000) * Math.ceil((S.W / 1000) / 0.45);
    rows.push({
      item: "Intermediate floor joists", gross_m2: round2(floorA), openings_m2: 0,
      net_m2: round2(floorA), waste_pct: 10,
      order_m2: round2(floorA * WASTE), spec: `≈${round2(joistLm)} lm @450 c/c`,
    });
  }

  return rows;
}

// ---------- bundled takeoff ----------

export type Takeoff = {
  studs: StudLine[];
  studTotals: StudTotals;
  openings: OpeningRow[];
  lintels: LintelRow[];
  bracing: BraceRow[];
  fixings: FixingRow[];
  areas: AreaRow[];
  bracingTotalBU: number;
};

export function buildTakeoff(S: AstralState): Takeoff {
  const studs = takeoffStuds(S);
  const bracing = scheduleBracing(S);
  return {
    studs,
    studTotals: studTotals(studs),
    openings: scheduleOpenings(S),
    lintels: scheduleLintels(S),
    bracing,
    fixings: takeoffFixings(S),
    areas: takeoffAreas(S),
    bracingTotalBU: bracing.reduce((a, b) => a + b.bu, 0),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
