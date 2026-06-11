// Consolidated top bar — brand + mode toggle + project chip + ⋯ menu.
// Replaces the previous brand-row + ProjectsBar + ExportBar stack.

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useAstral } from "@/lib/astral/store";
import { useProjectSession } from "@/lib/astral/projectSession";
import {
  createProject,
  updateProject,
  listProjects,
  type ProjectMeta,
  type ProjectMetaInput,
} from "@/lib/astral/projects";

type OverlayKind = null | "projects" | "export" | "materials" | "vision";

interface TopBarProps {
  overlay: OverlayKind;
  setOverlay: (k: OverlayKind) => void;
}

export function TopBar({ overlay, setOverlay }: TopBarProps) {
  const mode = useAstral((s) => s.mode);
  const patch = useAstral((s) => s.patch);
  const { user, loading } = useAuth();
  const currentId = useProjectSession((s) => s.currentProjectId);
  const setCurrentId = useProjectSession((s) => s.setCurrentProjectId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [meta, setMeta] = useState<ProjectMetaInput>({ name: "Untitled" });
  const [list, setList] = useState<ProjectMeta[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    listProjects().then(setList).catch(() => {});
  }, [user, currentId]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const currentName =
    list.find((p) => p.id === currentId)?.name ?? meta.name ?? "Untitled";

  const quickSave = async () => {
    if (!user) {
      setOverlay("projects");
      return;
    }
    const s = useAstral.getState();
    try {
      if (currentId) {
        await updateProject(currentId, s, { name: currentName });
      } else {
        const m = await createProject(s, { name: currentName });
        setCurrentId(m.id);
        setMeta({ name: m.name });
      }
    } catch {
      setOverlay("projects");
    }
  };

  const item = (label: string, onClick: () => void, icon = "·") => (
    <button
      type="button"
      className="astral-topmenu-item"
      onClick={() => {
        onClick();
        setMenuOpen(false);
      }}
    >
      <span className="ic" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );

  return (
    <header className="astral-top astral-top-v2">
      <div className="astral-top-left">
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
      </div>

      {mode === "build" && (
        <button
          type="button"
          className="astral-projectchip"
          onClick={() => setOverlay("projects")}
          title="Open project manager"
        >
          <span className="n">{currentName}</span>
          <span className="d">{user ? (currentId ? "saved" : "unsaved") : "local"}</span>
        </button>
      )}

      <div className="astral-top-right" ref={menuRef}>
        {mode === "build" && (
          <>
            <button
              type="button"
              className="astral-topbtn"
              onClick={quickSave}
              title="Quick save"
            >
              💾
            </button>
            <button
              type="button"
              className={`astral-topbtn astral-menubtn ${menuOpen ? "on" : ""}`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
          </>
        )}
        {menuOpen && (
          <div className="astral-topmenu" role="menu">
            <div className="astral-topmenu-section">Project</div>
            {item("Projects · open / save", () => setOverlay("projects"), "📂")}
            {item("Export PNG / PDF / CSV", () => setOverlay("export"), "📄")}
            <div className="astral-topmenu-section">Tools</div>
            {item("Materials & schedules", () => setOverlay("materials"), "📊")}
            {item("Vision · sketch & renders", () => setOverlay("vision"), "🖼")}
            <div className="astral-topmenu-section">Account</div>
            {loading ? null : user ? (
              <>
                <div className="astral-topmenu-meta">{user.email}</div>
                {item("Sign out", () => signOut(), "↪")}
              </>
            ) : (
              <Link
                to="/login"
                className="astral-topmenu-item"
                onClick={() => setMenuOpen(false)}
              >
                <span className="ic">→</span>
                <span>Sign in to save</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Mobile-only sticky mode footer */}
      <nav className="astral-mode-footer" aria-label="Mode">
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
      </nav>
    </header>
  );
}

export type { OverlayKind };
