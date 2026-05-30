// Composition root for the Astral configurator.

import "@/styles/astral.css";
import { Canvas } from "./Canvas";
import { ControlBar } from "./ControlBar";
import { SectionPanel } from "./SectionPanel";
import { Inspector } from "./Inspector";

export function AstralApp() {
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
    </div>
  );
}
