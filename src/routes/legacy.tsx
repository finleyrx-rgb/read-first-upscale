// Legacy single-file Astral app preserved as a fallback during the Phase 0b/0c port.
// Hosts public/astral.html in a full-viewport iframe so views not yet ported to
// React (elevation, section, detail) remain accessible.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legacy")({
  head: () => ({
    meta: [
      { title: "Project Astral · Legacy view" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LegacyPage,
});

function LegacyPage() {
  return (
    <iframe
      src="/astral.html"
      title="Project Astral (legacy)"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: "none", background: "#f3efe6" }}
    />
  );
}
