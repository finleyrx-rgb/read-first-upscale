// Project Astral — shared constants ported from public/astral.html
// Single source of truth for palettes, step list, wall metadata, templates.

export const CLAD = [
  { n: "Cream", h: "#ece6d6" },
  { n: "Sand", h: "#d8c7a3" },
  { n: "Clay", h: "#b06a45" },
  { n: "Sage", h: "#8f9b86" },
  { n: "Charcoal", h: "#3c3f43" },
  { n: "White", h: "#f4f2ec" },
] as const;

export const ROOFC = [
  { n: "Ironsand", h: "#33373b" },
  { n: "Grey Friars", h: "#50545a" },
  { n: "Titania", h: "#d6d2c8" },
  { n: "Karaka", h: "#39402f" },
  { n: "Sandstone", h: "#b7ab93" },
  { n: "Copper", h: "#9c5a32" },
] as const;

export const STEPS = [
  "Site",
  "Footprint",
  "Roof",
  "Openings",
  "Layout",
  "Finishes",
  "Resolve",
  "Outputs",
] as const;

export const STEP_TITLES = [
  "Site & exposure",
  "Footprint",
  "Roof",
  "Openings & joinery",
  "Internal layout",
  "Cladding & finishes",
  "Auto-resolve to the rules",
  "Your build",
];

export const STEP_BLURBS = [
  "Where it sits and what it's exposed to.",
  "Set size and stud height.",
  "Put a roof on it — try the colours, then flick to Elevation.",
  "Type a set-out measurement to place each door and window.",
  "Drop in internal walls to make rooms — placed by measurement.",
  "Skin it — see the cladding and roof colours on the elevations.",
  "Studs, lintels, bracing and tie-downs, worked out.",
  "Spec, materials and the checklist to make it real.",
];

export const WALLNAME = { S: "Front", N: "Back", W: "Left end", E: "Right end" } as const;
export const WALLREF = { S: "left", N: "left", W: "top", E: "top" } as const;

export const WALLTYPES = {
  External: { fill: "#1d2a2a", stroke: "#1d2a2a", label: "External" },
  Partition: { fill: "#cdbf9f", stroke: "#1d2a2a", label: "Partition" },
  Structural: { fill: "#c8975a", stroke: "#7a4a16", label: "Structural" },
  Wet: { fill: "#a8c8cf", stroke: "#2f6f7e", label: "Wet area" },
} as const;
export const WALLTYPE_KEYS = ["Partition", "Structural", "Wet"] as const;

export const TEMPLATES = [
  {
    n: "Garage 10×8",
    s: {
      type: "Garage", L: 10000, W: 8000, studH: 3000,
      roof: "Hip", pitch: 20, struct: "Prefab trusses",
      clad: "Plaster system", cover: "Colorsteel corrugate",
      ops: [["Garage", "W", 4000, 5000], ["Door", "S", 2000, 810], ["Window", "S", 7200, 1200]] as const,
    },
  },
  {
    n: "Sleepout 6×4",
    s: {
      type: "Sleepout", L: 6000, W: 4000, studH: 2700,
      roof: "Gable", pitch: 15, struct: "Cut roof",
      clad: "Weatherboard", cover: "Colorsteel corrugate",
      ops: [["Door", "S", 1000, 810], ["Window", "S", 3500, 1500], ["Window", "N", 3000, 1200]] as const,
    },
  },
  {
    n: "Cabin 7×5",
    s: {
      type: "Cabin", L: 7000, W: 5000, studH: 2700,
      roof: "Gable", pitch: 25, struct: "Cut roof",
      clad: "Ply + batten", cover: "Colorsteel corrugate",
      ops: [["Door", "S", 1200, 900], ["Window", "S", 4500, 1800], ["Window", "E", 2500, 1000]] as const,
    },
  },
  {
    n: "Studio 4×4",
    s: {
      type: "Studio", L: 4000, W: 4000, studH: 2700,
      roof: "Mono", pitch: 8, struct: "Cut roof",
      clad: "Fibre-cement", cover: "Membrane",
      ops: [["Door", "S", 800, 810], ["Window", "S", 2800, 1500]] as const,
    },
  },
  {
    n: "Tiny 8×3",
    s: {
      type: "Sleepout", L: 8000, W: 3000, studH: 2400,
      roof: "Mono", pitch: 6, struct: "Cut roof",
      clad: "Ply + batten", cover: "Membrane",
      ops: [
        ["Door", "S", 1000, 810],
        ["Window", "S", 3500, 1200],
        ["Window", "S", 6000, 800],
        ["Window", "N", 4000, 1500],
      ] as const,
    },
  },
  {
    n: "Workshop 12×8",
    s: {
      type: "Workshop", L: 12000, W: 8000, studH: 3300,
      roof: "Gable", pitch: 15, struct: "Prefab trusses",
      clad: "Fibre-cement", cover: "Colorsteel tray",
      ops: [
        ["Garage", "W", 4000, 5400],
        ["Door", "S", 1500, 900],
        ["Window", "S", 8000, 1800],
        ["Window", "N", 6000, 1200],
      ] as const,
    },
  },
] as const;

export type WallKey = "N" | "S" | "E" | "W";
export type ViewKey = "plan" | "elevation" | "section" | "detail";
export type LayerKey = "arch" | "framing" | "foundation";
export type FaceKey = "front" | "back" | "left" | "right";
export type CutKey = "cross" | "long";
export type UnitKey = "m" | "mm";
