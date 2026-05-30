// ProjectsBar — Phase 8 §7.9.
// Sits inside the Astral header. Shows auth state and project actions:
// sign in / sign out, save / save-as, open, share read-only.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useAstral } from "@/lib/astral/store";
import { useProjectSession } from "@/lib/astral/projectSession";
import {
  createProject, updateProject, listProjects, loadProject,
  deleteProject, setProjectShared, shareUrlFor,
  type ProjectMeta, type ProjectMetaInput,
} from "@/lib/astral/projects";

const BTN: React.CSSProperties = {
  padding: "6px 10px",
  background: "#fff",
  border: "1px solid var(--astral-line, #ccc)",
  borderRadius: 4,
  fontFamily: "var(--astral-mono)",
  fontSize: 11,
  cursor: "pointer",
};

export function ProjectsBar() {
  const { user, loading } = useAuth();
  const currentId = useProjectSession((s) => s.currentProjectId);
  const setCurrentId = useProjectSession((s) => s.setCurrentProjectId);
  const [currentMeta, setCurrentMeta] = useState<ProjectMetaInput>({ name: "Untitled project" });
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [open, setOpen] = useState<"none" | "list" | "meta" | "share">("none");
  const [shareInfo, setShareInfo] = useState<{ url: string; isPublic: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg((c) => (c === m ? null : c)), 2200); };

  useEffect(() => {
    if (!user) { setList([]); setCurrentId(null); return; }
    listProjects().then(setList).catch((e: Error) => flash(e.message));
  }, [user]);

  const refresh = async () => { try { setList(await listProjects()); } catch (e) { flash((e as Error).message); } };

  const doSave = async () => {
    if (!user) return flash("Sign in first");
    setBusy(true);
    try {
      const s = useAstral.getState();
      if (currentId) {
        const m = await updateProject(currentId, s, currentMeta);
        flash(`Saved "${m.name}"`); await refresh();
      } else {
        const m = await createProject(s, currentMeta);
        setCurrentId(m.id);
        flash(`Created "${m.name}"`); await refresh();
      }
    } catch (e) { flash((e as Error).message); } finally { setBusy(false); }
  };

  const doSaveAs = () => {
    const name = window.prompt("New project name:", currentMeta.name || "Untitled project");
    if (!name) return;
    setCurrentId(null);
    setCurrentMeta({ ...currentMeta, name });
    setTimeout(doSave, 0);
  };

  const doOpen = async (id: string) => {
    setBusy(true);
    try {
      const row = await loadProject(id);
      const snap = row.snapshot;
      if (snap?.state) useAstral.getState().patch(snap.state as never);
      setCurrentId(row.id);
      setCurrentMeta({
        name: row.name, address: row.address, notes: row.notes,
        start_date: row.start_date, finish_date: row.finish_date,
      });
      setOpen("none");
      flash(`Loaded "${row.name}"`);
    } catch (e) { flash((e as Error).message); } finally { setBusy(false); }
  };

  const doDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This can't be undone.`)) return;
    try { await deleteProject(id); if (id === currentId) setCurrentId(null); await refresh(); flash(`Deleted "${name}"`); }
    catch (e) { flash((e as Error).message); }
  };

  const doShare = async () => {
    if (!currentId) return flash("Save the project before sharing");
    const cur = list.find((p) => p.id === currentId);
    if (!cur) return;
    try {
      const next = !cur.is_public;
      const m = await setProjectShared(currentId, next);
      await refresh();
      setShareInfo({ url: shareUrlFor(m.share_token), isPublic: m.is_public });
      setOpen("share");
    } catch (e) { flash((e as Error).message); }
  };

  if (loading) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", flexWrap: "wrap",
      borderTop: "1px solid var(--astral-line, #ddd)", background: "var(--astral-pa, #fafaf7)",
    }}>
      <span style={{ fontFamily: "var(--astral-mono)", fontSize: 11, opacity: 0.7 }}>projects</span>

      {user ? (
        <>
          <input
            value={currentMeta.name}
            onChange={(e) => setCurrentMeta({ ...currentMeta, name: e.target.value })}
            placeholder="Project name"
            style={{ ...BTN, minWidth: 160, padding: "6px 8px" }}
          />
          <button style={BTN} onClick={() => setOpen(open === "meta" ? "none" : "meta")}>📋 Details</button>
          <button style={BTN} onClick={doSave} disabled={busy}>{currentId ? "💾 Save" : "＋ Save new"}</button>
          {currentId && <button style={BTN} onClick={doSaveAs} disabled={busy}>⎘ Save as…</button>}
          <button style={BTN} onClick={() => { refresh(); setOpen(open === "list" ? "none" : "list"); }}>📂 Open…</button>
          <button style={BTN} onClick={doShare} disabled={!currentId || busy}>🔗 Share read-only</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--astral-mono)", fontSize: 11, opacity: 0.6 }}>{user.email}</span>
          <button style={BTN} onClick={() => signOut()}>Sign out</button>
        </>
      ) : (
        <>
          <span style={{ fontFamily: "var(--astral-mono)", fontSize: 11, opacity: 0.6 }}>
            sign in to save · multi-device · shareable links
          </span>
          <span style={{ flex: 1 }} />
          <Link to="/login" style={{ ...BTN, textDecoration: "none", color: "inherit" }}>Sign in</Link>
        </>
      )}

      {msg && (
        <span style={{ width: "100%", fontFamily: "var(--astral-mono)", fontSize: 11, color: "var(--astral-ok, #3f7d54)" }}>
          {msg}
        </span>
      )}

      {open === "meta" && (
        <div style={{ width: "100%", marginTop: 6, padding: 10, background: "#fff", border: "1px solid var(--astral-line, #ddd)", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 11 }}>Address
            <input value={currentMeta.address ?? ""} onChange={(e) => setCurrentMeta({ ...currentMeta, address: e.target.value })}
              style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }} />
          </label>
          <label style={{ fontSize: 11 }}>Notes
            <input value={currentMeta.notes ?? ""} onChange={(e) => setCurrentMeta({ ...currentMeta, notes: e.target.value })}
              style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }} />
          </label>
          <label style={{ fontSize: 11 }}>Start date
            <input type="date" value={currentMeta.start_date ?? ""} onChange={(e) => setCurrentMeta({ ...currentMeta, start_date: e.target.value || null })}
              style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }} />
          </label>
          <label style={{ fontSize: 11 }}>Finish date
            <input type="date" value={currentMeta.finish_date ?? ""} onChange={(e) => setCurrentMeta({ ...currentMeta, finish_date: e.target.value || null })}
              style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }} />
          </label>
        </div>
      )}

      {open === "list" && (
        <div style={{ width: "100%", marginTop: 6, padding: 10, background: "#fff", border: "1px solid var(--astral-line, #ddd)", borderRadius: 6, maxHeight: 240, overflow: "auto" }}>
          {list.length === 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>No saved projects yet.</div>}
          {list.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #eee", fontSize: 12 }}>
              <strong style={{ flex: 1 }}>{p.name}</strong>
              <span style={{ opacity: 0.6 }}>{new Date(p.updated_at).toLocaleDateString()}</span>
              {p.is_public && <span style={{ color: "var(--astral-ok, #3f7d54)" }}>shared</span>}
              <button style={BTN} onClick={() => doOpen(p.id)}>Open</button>
              <button style={BTN} onClick={() => doDelete(p.id, p.name)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {open === "share" && shareInfo && (
        <div style={{ width: "100%", marginTop: 6, padding: 10, background: "#fff", border: "1px solid var(--astral-line, #ddd)", borderRadius: 6 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            {shareInfo.isPublic ? "Public read-only link is live." : "Sharing is OFF — link is inactive."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input readOnly value={shareInfo.url} onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{ flex: 1, padding: 6, border: "1px solid #ccc", borderRadius: 4, fontFamily: "var(--astral-mono)", fontSize: 11 }} />
            <button style={BTN} onClick={() => navigator.clipboard.writeText(shareInfo.url).then(() => flash("Link copied"))}>Copy</button>
            <button style={BTN} onClick={doShare}>{shareInfo.isPublic ? "Disable" : "Enable"}</button>
            <button style={BTN} onClick={() => setOpen("none")}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
