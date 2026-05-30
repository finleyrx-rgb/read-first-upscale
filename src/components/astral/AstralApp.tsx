// Composition root for the Astral configurator.

import { useEffect } from "react";
import "@/styles/astral.css";
import { Canvas } from "./Canvas";
import { ControlBar } from "./ControlBar";
import { SectionPanel } from "./SectionPanel";
import { Inspector } from "./Inspector";
import { ExportBar } from "./ExportBar";
import { MaterialsPanel } from "./MaterialsPanel";
import { ProjectsBar } from "./ProjectsBar";
import { useAstral, readStoredUnit } from "@/lib/astral/store";

export function AstralApp() {
  // Hydrate the unit preference post-mount so SSR HTML matches initial render.
  const setUnit = useAstral((s) => s.set);
  useEffect(() => {
    const stored = readStoredUnit();
    if (stored !== useAstral.getState().unit) setUnit("unit", stored);
  }, [setUnit]);

  return (
    <div className="astral-root">
      <header className="astral-top">
        <div className="astral-brand">
          <span className="mark">Project <em>Astral</em></span>
          <span className="sub">build flow</span>
        </div>
        <div className="astral-topnote">
          Concept configurator · sizes to NZS 3604 where in scope · SED items flagged, not designed
        </div>
      </header>
      <ProjectsBar />
      <ExportBar />
      <div className="astral-wrap">
        <div className="astral-stage">
          <div className="astral-canvas">
            <ControlBar />
            <Canvas />
          </div>
          <Inspector />
        </div>
        <SectionPanel />
        <MaterialsPanel />
      </div>
    </div>
  );
}
