import { createFileRoute } from "@tanstack/react-router";
import { AstralApp } from "@/components/astral/AstralApp";

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
      { property: "og:description", content: "Model-first NZ construction configurator." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  component: Index,
});

function Index() {
  return <AstralApp />;
}
