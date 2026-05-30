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
import { VisionPanel } from "./VisionPanel";
import { useAstral, readStoredUnit, readBootstrap, INITIAL_STATE } from "@/lib/astral/store";
import { useProjectSession } from "@/lib/astral/projectSession";
import { AstralDrawer } from "./AstralDrawer";

export function AstralApp() {
  // Hydrate URL share / localStorage / unit preference post-mount so SSR HTML
  // matches the initial client render (avoids hydration mismatch).
  const patch = useAstral((s) => s.patch);
  useEffect(() => {
    const boot = readBootstrap();
    const stored = readStoredUnit();
    if (boot) patch({ ...boot, unit: INITIAL_STATE.unit, view: INITIAL_STATE.view });
    if (stored !== useAstral.getState().unit) patch({ unit: stored });
  }, [patch]);

  const currentProjectId = useProjectSession((s) => s.currentProjectId);

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
        <VisionPanel projectId={currentProjectId} />
      </div>
      <AstralDrawer projectKey={currentProjectId ?? "local"} />
    </div>
  );
}
