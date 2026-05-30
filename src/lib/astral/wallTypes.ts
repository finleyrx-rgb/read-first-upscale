// Wall-type taxonomy (Master Plan Phase 2 / Upscale §7.1).
// Each external wall (N/S/E/W) is one of these construction types.
// Drives both Inspector edit + per-wall graphic style on the architectural plan.

export const WALL_TYPES = [
  "new-timber",
  "existing-timber",
  "existing-masonry",
  "concrete-panel",
  "intertenancy",
] as const;

export type WallType = (typeof WALL_TYPES)[number];

export type WallTypeStyle = {
  label: string;
  /** Fill colour for the wall strip (paper tones, never raw white). */
  fill: string;
  /** Inner+outer line stroke. */
  stroke: string;
  /** Stroke width in plan units. */
  strokeWidth: number;
  /** Dash pattern for the stroke (none = solid). */
  dash?: string;
  /** Optional SVG <pattern> id painted over the strip. */
  hatch?: "diag" | "dot" | "double";
};

export const WALL_TYPE_STYLES: Record<WallType, WallTypeStyle> = {
  "new-timber": {
    label: "New timber framed",
    fill: "#efe7d2",
    stroke: "#1d2a2a",
    strokeWidth: 1.6,
  },
  "existing-timber": {
    label: "Existing timber",
    fill: "#efe7d2",
    stroke: "#1d2a2a",
    strokeWidth: 1.2,
    dash: "5 3",
  },
  "existing-masonry": {
    label: "Existing masonry",
    fill: "#d8c9a7",
    stroke: "#1d2a2a",
    strokeWidth: 1.6,
    hatch: "diag",
  },
  "concrete-panel": {
    label: "Concrete panel",
    fill: "#bcb09a",
    stroke: "#1d2a2a",
    strokeWidth: 1.8,
  },
  intertenancy: {
    label: "Intertenancy",
    fill: "#e6dcc1",
    stroke: "#1d2a2a",
    strokeWidth: 1.4,
    hatch: "double",
  },
};

export const DEFAULT_WALL_TYPES = {
  N: "new-timber",
  S: "new-timber",
  E: "new-timber",
  W: "new-timber",
} as const satisfies Record<"N" | "S" | "E" | "W", WallType>;
