import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Project Astral · Build Flow" },
      {
        name: "description",
        content:
          "Project Astral — NZ construction configurator. One hierarchical model, many projections (plans, elevations, sections, details).",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:title", content: "Project Astral · Build Flow" },
      {
        property: "og:description",
        content: "Model-first NZ construction configurator.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  // Phase 0: serve the existing single-file Astral app at the project root URL
  // so it runs as the app (not as a sandboxed /documents/ file). React component
  // decomposition (Canvas, ControlBar, SectionPanel, Inspector, Zustand store)
  // is the work of Phase 0b onwards.
  return (
    <iframe
      src="/astral.html"
      title="Project Astral"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        background: "#f3efe6",
      }}
    />
  );
}
