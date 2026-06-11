// Shared types for plan ingestion. Pure module — safe in client & server.

import type { AgentAction } from "../agent/grammar";

export type PageKind =
  | "floor-plan"
  | "elevation"
  | "section"
  | "detail"
  | "schedule"
  | "cover"
  | "other";

export type PageAnalysis = {
  pageIndex: number; // 1-based
  kind: PageKind;
  scale?: string;
  faceCompass?: "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";
  footprint?: { L: number; W: number };
  openings?: Array<{
    wall?: "N" | "S" | "E" | "W";
    kind: "Door" | "Window" | "Garage";
    off?: number;
    width: number;
  }>;
  partitions?: Array<{ dir: "Across width" | "Along length"; off: number }>;
  studH?: number;
  roof?: { form?: string; pitch?: number };
  notes?: string[];
  confidence: number; // 0..1
  /** Proposed model mutations derived from this page. User reviews before apply. */
  proposedActions: AgentAction[];
  /** Free-text agent summary. */
  summary?: string;
  error?: string;
};
