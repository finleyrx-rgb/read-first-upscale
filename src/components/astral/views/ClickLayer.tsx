// Shared selection delegation — promotes any child with data-node-id to a clickable
// node and routes it to the store's setSel action. Also handles section-marker
// clicks (data-section-cut) and detail-callout clicks (data-callout-key).

import type { ReactNode, MouseEvent } from "react";
import { useAstral } from "@/lib/astral/store";
import type { CutKey } from "@/lib/astral/constants";

export function ClickLayer({ children }: { children: ReactNode }) {
  const setSel = useAstral((s) => s.setSel);
  const setDetailFor = useAstral((s) => s.setDetailFor);
  const patch = useAstral((s) => s.patch);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    // walk up the DOM looking for the first interesting marker
    let n = e.target as Element | null;
    while (n && n !== e.currentTarget) {
      const cut = n.getAttribute?.("data-section-cut") as CutKey | null;
      if (cut) { patch({ cut, view: "section" }); return; }
      const callout = n.getAttribute?.("data-callout-key");
      if (callout) {
        const nodeId = n.getAttribute("data-callout-node");
        if (nodeId) { setSel(nodeId); setDetailFor(nodeId); }
        patch({ view: "detail" });
        return;
      }
      const nodeId = n.getAttribute?.("data-node-id");
      if (nodeId) { setSel(nodeId); return; }
      n = n.parentNode as Element | null;
    }
  };

  return <div onClick={onClick} style={{ position: "relative" }}>{children}</div>;
}
