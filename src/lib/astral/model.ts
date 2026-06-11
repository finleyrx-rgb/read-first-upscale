// Project Astral — model + rules (single source of truth for derivations).
// Ported from the canonical logic in public/astral.html (NZS 3604-aware).

import type { AstralState, Opening } from "./store";
import { WALLNAME } from "./constants";

export type RuleResult = { v: string; sed: boolean; n: string };

export type ModelNode = {
  id: string;
  type: string;
  name: string;
  parent: string | null;
  children: string[];
  params: Record<string, unknown>;
  geometry: Record<string, unknown>;
  derived: Record<string, unknown>;
  compliance: {
    rule: string;
    value: string;
    status: "ok" | "sed";
    basis: string;
    raw: RuleResult;
  }[];
};

export type Model = { root: ModelNode; byId: Record<string, ModelNode> };

const wallLen = (S: AstralState, w: "N" | "S" | "E" | "W") => (w === "N" || w === "S" ? S.L : S.W);

export const wallEnd = wallLen;

const isHighWind = (wind: string) =>
  ["High", "Very High", "Extra High", "Cyclonic (SED)"].includes(wind);

export function studRule(S: AstralState): RuleResult {
  const eh = S.wind === "Extra High" || S.wind === "Cyclonic (SED)";
  const sp = "@" + S.spacing;
  const loadedDim = Math.round(S.W / 2);
  if (S.studH >= 3000)
    return eh
      ? {
          v: "140×45 SG8 " + sp,
          sed: false,
          n: `3604 T8.2 · ${S.wind} · LD ${(loadedDim / 1000).toFixed(1)}m · indicative`,
        }
      : { v: "90×70 SG8 " + sp, sed: false, n: `3604 T8.2 · ${S.wind} · 3.0m · indicative` };
  if (S.studH >= 2700)
    return eh
      ? { v: "90×70 SG8 " + sp, sed: false, n: `3604 T8.2 · ${S.wind} · indicative` }
      : { v: "90×45 SG8 " + sp, sed: false, n: `3604 T8.2 · ${S.wind} · indicative` };
  return { v: "90×45 SG8 " + sp, sed: false, n: `3604 T8.2 · ${S.wind} · indicative` };
}

export function lintelRule(span: number): RuleResult {
  if (span > 3000)
    return { v: "Engineered head / portal", sed: true, n: `${span}mm > 3604 lintel range → SED` };
  if (span <= 1200) return { v: "2/90×45 SG8", sed: false, n: `${span}mm` };
  if (span <= 2000) return { v: "2/140×45 SG8", sed: false, n: `${span}mm` };
  return { v: "2/190×45 SG8", sed: false, n: `${span}mm` };
}

export function roofRule(S: AstralState): RuleResult {
  const span = S.W;
  if (S.struct.includes("truss"))
    return {
      v: `Prefab ${S.roof === "Hip" ? "hip " : ""}trusses @900`,
      sed: true,
      n: `${(span / 1000).toFixed(1)}m span · fabricator PS1`,
    };
  if (span > 6000)
    return { v: "Engineered rafters/beam", sed: true, n: `${(span / 1000).toFixed(1)}m → SED` };
  return { v: "Cut roof per 3604", sed: false, n: `${(span / 1000).toFixed(1)}m span` };
}

export function bracingRule(S: AstralState): RuleResult {
  let gov: "N" | "S" | "E" | "W" | null = null;
  (["N", "S", "E", "W"] as const).forEach((w) => {
    const tot = S.openings.filter((o) => o.wall === w).reduce((a, o) => a + o.width, 0);
    if (tot > 0.45 * wallLen(S, w)) gov = w;
  });
  if (gov !== null) {
    const g = gov as "N" | "S" | "E" | "W";
    return {
      v: `Engineered portal at ${WALLNAME[g].toLowerCase()}`,
      sed: true,
      n: "Opening(s) leave little wall on that line → governing",
    };
  }
  const area = (S.L * S.W) / 1e6;
  const f =
    (
      {
        Medium: 0.7,
        High: 1.0,
        "Very High": 1.3,
        "Extra High": 1.6,
        "Cyclonic (SED)": 2.0,
      } as Record<string, number>
    )[S.wind] || 1.6;
  return {
    v: `~${Math.round(area * 55 * f)} BUs each way (indicative)`,
    sed: false,
    n: "Achieved via P21 panels — confirm",
  };
}

export function tieRule(S: AstralState): RuleResult {
  const hi = isHighWind(S.wind);
  return hi
    ? {
        v: "Cyclone straps + M12 chem anchors @600",
        sed: S.wind === "Cyclonic (SED)",
        n: "Strap every truss/rafter, both ends",
      }
    : { v: "Standard 3604 fixings", sed: false, n: "Skew nails / wire dogs" };
}

export function footRule(S: AstralState): RuleResult {
  const big = S.struct.includes("truss") || S.W > 6000 || S.wind === "Cyclonic (SED)";
  return {
    v: S.found === "Concrete slab" ? "Slab + thickened edge & pads" : "Engineered pile foundation",
    sed: true,
    n: big ? "Loads/spans → engineer + PS1" : "Confirm engineer",
  };
}

export function qtys(S: AstralState) {
  const Lm = S.L / 1000,
    Wm = S.W / 1000,
    Hm = S.studH / 1000;
  const perim = 2 * (Lm + Wm),
    wallA = perim * Hm * S.storeys,
    floorA = Lm * Wm * S.storeys;
  const roofA =
    S.roof === "Flat" ? floorA * 1.05 : (floorA / Math.cos((S.pitch * Math.PI) / 180)) * 1.06;
  return {
    perim: perim.toFixed(1),
    floorA: floorA.toFixed(0),
    wallA: wallA.toFixed(0),
    roofA: roofA.toFixed(0),
    concrete: (floorA * 0.1 + perim * 0.05).toFixed(1),
    mesh: Math.ceil(floorA / 12.5),
    studsLm: Math.round((perim / (S.spacing / 1000)) * Hm * S.storeys + perim * 3 * S.storeys),
    purlinsLm: Math.round(roofA / 0.9),
    roofingM2: Math.round(roofA),
    cladM2: Math.round(wallA * 0.86),
    liningM2: Math.round(wallA * 0.86),
    joinery: `${S.openings.length} openings`,
  };
}

function mk(
  id: string,
  type: string,
  name: string,
  parent: string | null,
  params: Record<string, unknown> = {},
  geometry: Record<string, unknown> = {},
): ModelNode {
  return { id, type, name, parent, children: [], params, geometry, derived: {}, compliance: [] };
}

export function buildModel(S: AstralState): Model {
  const byId: Record<string, ModelNode> = {};
  const add = (n: ModelNode) => {
    byId[n.id] = n;
    return n;
  };

  const site = add(mk("site", "Site", "Site", null, { wind: S.wind, found: S.found }));
  const bld = add(
    mk(
      "building",
      "Building",
      S.type,
      "site",
      {
        type: S.type,
        L: S.L,
        W: S.W,
        studH: S.studH,
        spacing: S.spacing,
        storeys: S.storeys,
        floorDepth: S.floorDepth,
      },
      { footprint: { L: S.L, W: S.W } },
    ),
  );
  site.children.push("building");

  const slab = add(
    mk(
      "slab",
      "Slab",
      "Slab / Foundation",
      "building",
      { found: S.found },
      { outline: { L: S.L, W: S.W } },
    ),
  );
  bld.children.push(slab.id);

  if (S.storeys === 2) {
    const sf = add(
      mk("suspended-floor", "SuspendedFloor", "Intermediate floor", "building", {
        depth: S.floorDepth,
      }),
    );
    bld.children.push(sf.id);
  }

  (["N", "S", "E", "W"] as const).forEach((w) => {
    const wall = add(
      mk(`wall-${w}`, "Wall", WALLNAME[w], "building", {
        wall: w,
        type: "External",
        length: wallLen(S, w),
        height: S.studH,
        studSpec: studRule(S).v,
      }),
    );
    bld.children.push(wall.id);
  });

  S.openings.forEach((o) => {
    const op = add(
      mk(`opening-${o.id}`, "Opening", o.kind, `wall-${o.wall}`, {
        kind: o.kind,
        width: o.width,
        off: o.off,
        wall: o.wall,
      }),
    );
    const pw = byId[`wall-${o.wall}`];
    if (pw) pw.children.push(op.id);
  });

  const roof = add(
    mk(
      "roof",
      "RoofSystem",
      `${S.roof} roof`,
      "building",
      { form: S.roof, pitch: S.pitch, cover: S.cover, struct: S.struct },
      { pitch: S.pitch },
    ),
  );
  bld.children.push(roof.id);

  S.parts.forEach((p) => {
    const pt = add(
      mk(`part-${p.id}`, "Partition", "Partition", "building", {
        dir: p.dir,
        off: p.off,
        start: p.start,
        len: p.len,
        door: p.door,
        doorW: p.doorW,
        doorOff: p.doorOff,
        type: p.type,
      }),
    );
    bld.children.push(pt.id);
  });

  // derivations + rules
  Object.values(byId).forEach((n) => {
    if (n.type === "Wall") {
      const len = (n.params.length as number) || 0;
      n.derived = {
        studs: { count: Math.round(len / S.spacing) + 1, size: studRule(S).v },
        topPlate: 2,
        bottomPlate: 1,
      };
      const r = studRule(S);
      n.compliance.push({
        rule: "stud",
        value: r.v,
        status: r.sed ? "sed" : "ok",
        basis: r.n,
        raw: r,
      });
    } else if (n.type === "Opening") {
      const r = lintelRule(n.params.width as number);
      n.derived = { lintel: r, trimmingStuds: 2, sill: n.params.kind === "Window" };
      n.compliance.push({
        rule: "lintel",
        value: r.v,
        status: r.sed ? "sed" : "ok",
        basis: r.n,
        raw: r,
      });
    } else if (n.type === "RoofSystem") {
      const r = roofRule(S);
      n.derived = {
        system: S.struct.includes("truss") ? "Prefab trusses" : "Cut rafters",
        members: Math.round(S.L / 900),
        purlins: Math.round((S.L * S.W) / 1e6 / 0.9),
      };
      n.compliance.push({
        rule: "structure",
        value: r.v,
        status: r.sed ? "sed" : "ok",
        basis: r.n,
        raw: r,
      });
    } else if (n.type === "Building") {
      n.derived = { bracing: bracingRule(S).v, tieDown: tieRule(S).v };
      [
        { id: "bracing", r: bracingRule(S) },
        { id: "tie", r: tieRule(S) },
        { id: "foundation", r: footRule(S) },
        {
          id: "lintels",
          r: lintelRule(
            Math.max(
              810,
              ...S.openings
                .filter((o: Opening) => o.kind !== "Garage")
                .map((o: Opening) => o.width),
              0,
            ),
          ),
        },
      ].forEach(({ id, r }) =>
        n.compliance.push({
          rule: id,
          value: r.v,
          status: r.sed ? "sed" : "ok",
          basis: r.n,
          raw: r,
        }),
      );
    }
  });

  return { root: site, byId };
}

export function getCompliance(M: Model | null, id: string, rule: string): RuleResult | null {
  if (!M) return null;
  const nd = M.byId[id];
  if (!nd) return null;
  const x = nd.compliance.find((e) => e.rule === rule);
  return x ? x.raw : null;
}
