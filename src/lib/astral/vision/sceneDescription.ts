// Pure helper — turns the live AstralState into a compact textual description
// used as the prompt for the site-photo concept render (Phase 10).
//
// Safe to import from server (image-gen prompt) and client (preview).

import type { AstralState } from "../store";

export function describeBuilding(s: AstralState): string {
  const L = (s.L / 1000).toFixed(1);
  const W = (s.W / 1000).toFixed(1);
  const H = (s.studH / 1000).toFixed(1);

  const openings = s.openings.map((o) => {
    const wall = { N: "north", S: "south", E: "east", W: "west" }[o.wall];
    const w = (o.width / 1000).toFixed(1);
    return `${o.kind.toLowerCase()} ~${w}m wide on ${wall} wall`;
  });

  const parts: string[] = [
    `A simple single-storey ${s.type.toLowerCase()} in light timber framing.`,
    `Footprint ${L}m × ${W}m, stud height ${H}m.`,
    `Roof: ${s.roof} at ${s.pitch}° in ${s.cover} (${s.roofCol}).`,
    `Cladding: ${s.clad} in ${s.cladCol}. Joinery: ${s.joinery}.`,
    s.units > 1 ? `Configured as ${s.units} units.` : "",
    s.parapet ? "Has a parapet detail." : "",
  ].filter(Boolean);

  if (openings.length) parts.push("Openings: " + openings.join("; ") + ".");

  return parts.join(" ");
}
