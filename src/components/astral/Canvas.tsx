// Canvas — slim view router. Renders the active view+layer combo by composing the
// modular SVG view components in views/. Plus the floating quantities chip strip.

import React, { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAstral } from "@/lib/astral/store";
import { qtys } from "@/lib/astral/model";
import { PlanView } from "./views/PlanView";
import { FramingPlan } from "./views/FramingPlan";
import { FoundationPlan } from "./views/FoundationPlan";
import { ElevationView } from "./views/ElevationView";
import { SectionView } from "./views/SectionView";
import { DetailView } from "./views/DetailView";
import { ServicesPlan } from "./views/ServicesPlan";

function Chips() {
  const S = useAstral(useShallow((s) => ({
    L: s.L, W: s.W, wind: s.wind, roof: s.roof, roofCol: s.roofCol,
    clad: s.clad, cladCol: s.cladCol, openings: s.openings, studH: s.studH,
    spacing: s.spacing, pitch: s.pitch, cover: s.cover, struct: s.struct,
    found: s.found,
  })));
  const q = useMemo(() => qtys(S as never), [S]);
  return (
    <div className="astral-chips">
      <span className="astral-stat"><b>{q.floorA}</b> m² floor</span>
      <span className="astral-pill">{S.wind} wind</span>
      <span className="astral-pill">{S.roof} · {S.roofCol}</span>
      <span className="astral-pill">{S.clad.split(" ")[0]} · {S.cladCol}</span>
    </div>
  );
}

export function Canvas() {
  const view = useAstral((s) => s.view);
  const layer = useAstral((s) => s.layer);

  let body: React.ReactElement;
  if (view === "detail") body = <DetailView />;
  else if (view === "section") body = <SectionView />;
  else if (view === "elevation") body = <ElevationView />;
  else if (layer === "framing") body = <FramingPlan />;
  else if (layer === "foundation") body = <FoundationPlan />;
  else if (layer === "services") body = <ServicesPlan />;
  else body = <PlanView />;

  return (
    <div style={{ position: "relative" }}>
      {body}
      <Chips />
    </div>
  );
}
