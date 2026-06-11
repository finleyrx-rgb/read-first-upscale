// Composition root for the Astral configurator.

import { useEffect, useState } from "react";
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
import { DreamWorkspace, WelcomeCard } from "./DreamWorkspace";

const WELCOME_KEY = "astral.welcome.seen.v1";

export function AstralApp() {
  const patch = useAstral((s) => s.patch);
  const mode = useAstral((s) => s.mode);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const boot = readBootstrap();
    const stored = readStoredUnit();
    if (boot) patch({ ...boot, unit: INITIAL_STATE.unit, view: INITIAL_STATE.view });
    if (stored !== useAstral.getState().unit) patch({ unit: stored });
    try {
      if (!window.localStorage.getItem(WELCOME_KEY) && !boot) setShowWelcome(true);
    } catch {
      /* noop */
    }
  }, [patch]);

  function dismissWelcome() {
    setShowWelcome(false);
    try {
      window.localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* noop */
    }
  }

  const currentProjectId = useProjectSession((s) => s.currentProjectId);

  return (
    <div className={`astral-root mode-${mode}`}>
      <header className="astral-top">
        <div className="astral-brand">
          <span className="mark">
            Project <em>Astral</em>
          </span>
        </div>
        <div className="astral-mode-toggle" role="tablist" aria-label="Mode">
          <button
            type="button"
            className={mode === "dream" ? "on" : ""}
            onClick={() => patch({ mode: "dream" })}
          >
            ✦ Dream
          </button>
          <button
            type="button"
            className={mode === "build" ? "on" : ""}
            onClick={() => patch({ mode: "build" })}
          >
            ▢ Build
          </button>
        </div>
        <div className="astral-topnote">
          {mode === "build"
            ? "Concept configurator · NZS 3604-aware · SED items flagged"
            : "Think in spatial qualities · Crystallise when ready"}
        </div>
      </header>

      {mode === "build" ? (
        <>
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
        </>
      ) : (
        <DreamWorkspace />
      )}

      <AstralDrawer projectKey={currentProjectId ?? "local"} />
      {showWelcome && <WelcomeCard onDismiss={dismissWelcome} />}
    </div>
  );
}
