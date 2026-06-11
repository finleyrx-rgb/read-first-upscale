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
import { TopBar, type OverlayKind } from "./TopBar";
import { OverlaySheet } from "./OverlaySheet";
import { useAstral, readStoredUnit, readBootstrap, INITIAL_STATE } from "@/lib/astral/store";
import { useProjectSession } from "@/lib/astral/projectSession";
import { AstralDrawer } from "./AstralDrawer";
import { DreamWorkspace, WelcomeCard } from "./DreamWorkspace";

const WELCOME_KEY = "astral.welcome.seen.v1";

export function AstralApp() {
  const patch = useAstral((s) => s.patch);
  const mode = useAstral((s) => s.mode);
  const [showWelcome, setShowWelcome] = useState(false);
  const [overlay, setOverlay] = useState<OverlayKind>(null);

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

  function welcomeAction(kind: "template" | "upload" | "sketch") {
    patch({ mode: "build" });
    if (kind === "template") {
      useAstral.getState().loadTemplate(0);
    } else if (kind === "upload" || kind === "sketch") {
      setOverlay("vision");
    }
    dismissWelcome();
  }

  const currentProjectId = useProjectSession((s) => s.currentProjectId);

  return (
    <div className={`astral-root mode-${mode}`}>
      <TopBar overlay={overlay} setOverlay={setOverlay} />

      {mode === "build" ? (
        <div className="astral-wrap">
          <div className="astral-stage">
            <div className="astral-canvas">
              <ControlBar />
              <Canvas />
            </div>
            <Inspector />
          </div>
          <SectionPanel />
        </div>
      ) : (
        <DreamWorkspace />
      )}

      {/* Overlay sheets — hidden by default, opened from ⋯ menu */}
      <OverlaySheet
        open={overlay === "projects"}
        title="Projects"
        onClose={() => setOverlay(null)}
      >
        <ProjectsBar />
      </OverlaySheet>
      <OverlaySheet open={overlay === "export"} title="Export" onClose={() => setOverlay(null)}>
        <ExportBar />
      </OverlaySheet>
      <OverlaySheet
        open={overlay === "materials"}
        title="Materials & schedules"
        onClose={() => setOverlay(null)}
      >
        <MaterialsPanel />
      </OverlaySheet>
      <OverlaySheet
        open={overlay === "vision"}
        title="Vision · sketch & renders"
        onClose={() => setOverlay(null)}
      >
        <VisionPanel projectId={currentProjectId} />
      </OverlaySheet>

      <AstralDrawer projectKey={currentProjectId ?? "local"} />
      {showWelcome && (
        <WelcomeCard onDismiss={dismissWelcome} onAction={welcomeAction} />
      )}
    </div>
  );
}
