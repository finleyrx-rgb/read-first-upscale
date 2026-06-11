// Right-side overlay sheet for panels that are hidden by default.

import type { ReactNode } from "react";
import { useEffect } from "react";

export function OverlaySheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="astral-sheet-backdrop" onClick={onClose}>
      <aside
        className="astral-sheet"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="astral-sheet-h">
          <span className="t">{title}</span>
          <button type="button" className="astral-sheet-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="astral-sheet-body">{children}</div>
      </aside>
    </div>
  );
}
