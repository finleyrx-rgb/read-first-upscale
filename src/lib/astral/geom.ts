// Project Astral — pure geometry + palette helpers shared by all canvas views.
// Mirrors the legacy helpers in public/astral.html (planGeom, openFrac, braceLayout,
// lintelDepthMM, nogRows, cladHex, roofHex).

import { CLAD, ROOFC, type WallKey } from "./constants";
import { defaultHead, defaultSill, type AstralState, type Opening } from "./store";

/** Resolved head height (mm above FFL) for an opening, honoring per-opening overrides. */
export function openingHead(o: Opening, studH: number): number {
  return o.head ?? defaultHead(o.kind, studH);
}
/** Resolved sill height (mm above FFL) for an opening. */
export function openingSill(o: Opening): number {
  return o.sill ?? defaultSill(o.kind);
}
/** Resolved opening height (mm) = head − sill, clamped ≥ 0. */
export function openingOH(o: Opening, studH: number): number {
  return Math.max(0, openingHead(o, studH) - openingSill(o));
}
/** Maximum allowed head height = studH − lintel depth − top-plate allowance (90mm). */
export function maxHead(width: number, studH: number): number {
  return Math.max(0, studH - lintelDepthMM(width) - 90);
}

export const VW = 600;
export const VH = 440;
export const PLAN_MARGIN = 66;

export function wallLen(S: Pick<AstralState, "L" | "W">, w: WallKey): number {
  return w === "N" || w === "S" ? S.L : S.W;
}

export function openFrac(S: Pick<AstralState, "L" | "W">, o: Opening): number {
  return Math.max(0, Math.min(1, o.off / wallLen(S, o.wall)));
}

export function planGeom(S: Pick<AstralState, "L" | "W">) {
  const sc = Math.min((VW - 2 * PLAN_MARGIN) / S.L, (VH - 2 * PLAN_MARGIN) / S.W);
  const w = S.L * sc;
  const h = S.W * sc;
  const x0 = (VW - w) / 2;
  const y0 = (VH - h) / 2;
  const tt = Math.max(3, 90 * sc);
  return { sc, w, h, x0, y0, tt };
}

export function openPlace(S: Pick<AstralState, "L" | "W">, o: Opening, g: ReturnType<typeof planGeom>) {
  const { sc, w, h, x0, y0 } = g;
  const fr = openFrac(S, o);
  const owid = Math.min(o.width, wallLen(S, o.wall) * 0.95) * sc;
  let horiz = true, cx = 0, cy = 0;
  if (o.wall === "N") { horiz = true; cx = x0 + fr * w; cy = y0; }
  else if (o.wall === "S") { horiz = true; cx = x0 + fr * w; cy = y0 + h; }
  else if (o.wall === "W") { horiz = false; cx = x0; cy = y0 + fr * h; }
  else { horiz = false; cx = x0 + w; cy = y0 + fr * h; }
  return { horiz, cx, cy, owid };
}

export function lintelDepthMM(span: number): number {
  if (span > 3000) return 240;
  if (span <= 1200) return 90;
  if (span <= 2000) return 140;
  return 190;
}

export function nogRows(studH: number): number {
  return Math.max(1, Math.round(studH / 1350));
}

export function braceLayout(S: Pick<AstralState, "L" | "W" | "openings">, wall: WallKey) {
  const len = wallLen(S, wall);
  const ops = S.openings.filter((o) => o.wall === wall).map((o) => [o.off - o.width / 2, o.off + o.width / 2] as const);
  const clear = (a: number, b: number) => !ops.some(([s, e]) => b > s && a < e);
  const pw = 900;
  const cand = [200, (len - pw) / 2, len - pw - 200];
  const out: number[] = [];
  cand.forEach((raw) => {
    const st = Math.max(100, Math.min(len - pw - 100, raw));
    if (clear(st, st + pw) && !out.some((o) => Math.abs(o - st) < pw * 1.2)) out.push(st);
  });
  return out.map((start) => ({ start, len: pw }));
}

export function cladHex(name: string): string {
  return CLAD.find((c) => c.n === name)?.h || CLAD[0].h;
}

export function roofHex(name: string): string {
  return ROOFC.find((c) => c.n === name)?.h || ROOFC[0].h;
}

export const KIND_COL: Record<Opening["kind"], string> = {
  Garage: "#bf6b2c",
  Door: "#3f7d54",
  Window: "#2f6f7e",
};

export const FACE_WALL = { front: "S", back: "N", left: "W", right: "E" } as const;
export const FACE_LABEL = { front: "FRONT", back: "BACK", left: "LEFT", right: "RIGHT" } as const;
