// Shared selection delegation — promotes any child with data-node-id to a clickable
// node and routes it to the store's setSel action.

import type { ReactNode, MouseEvent } from "react";
import { useAstral } from "@/lib/astral/store";

export function ClickLayer({ children }: { children: ReactNode }) {
  const setSel = useAstral((s) => s.setSel);
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    let n = e.target as Element | null;
    while (n && n !== e.currentTarget && !n.getAttribute?.("data-node-id")) {
      n = n.parentNode as Element | null;
    }
    const id = n?.getAttribute?.("data-node-id");
    if (id) setSel(id);
  };
  return <div onClick={onClick} style={{ position: "relative" }}>{children}</div>;
}
