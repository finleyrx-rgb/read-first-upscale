// /shared/$token — read-only viewer for a publicly shared project.

import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchSharedProject } from "@/lib/astral/shared.functions";
import { useAstral } from "@/lib/astral/store";
import { AstralApp } from "@/components/astral/AstralApp";

export const Route = createFileRoute("/shared/$token")({
  head: () => ({ meta: [{ title: "Shared project · Project Astral" }] }),
  component: SharedPage,
  errorComponent: ({ error }) => (
    <div style={{ padding: 32, fontFamily: "system-ui" }}>
      <h2>Can't open shared project</h2>
      <p style={{ opacity: 0.7 }}>{error.message}</p>
      <Link to="/">← back</Link>
    </div>
  ),
  notFoundComponent: () => <div style={{ padding: 32 }}>Shared link not found.</div>,
});

function SharedPage() {
  const { token } = useParams({ from: "/shared/$token" });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [meta, setMeta] = useState<{ name: string; address?: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSharedProject({ data: { token } })
      .then((row) => {
        if (cancelled) return;
        const snap = (row.snapshot as { state?: unknown }) ?? {};
        const state = (snap as { state?: Record<string, unknown> }).state;
        if (!state) throw new Error("Snapshot is empty");
        useAstral.getState().patch(state as never);
        setMeta({ name: row.name, address: row.address });
        setStatus("ready");
      })
      .catch((e: Error) => { if (!cancelled) { setErr(e.message); setStatus("error"); } });
    return () => { cancelled = true; };
  }, [token]);

  if (status === "loading") return <div style={{ padding: 32 }}>Loading shared project…</div>;
  if (status === "error") return <div style={{ padding: 32, color: "#c25a3a" }}>{err}</div>;

  return (
    <div>
      <div style={{
        padding: "8px 14px", background: "#fff7e0", borderBottom: "1px solid #e3d59e",
        fontFamily: "var(--astral-mono, ui-sans-serif)", fontSize: 12,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <strong>Read-only share</strong>
        <span>· {meta?.name}{meta?.address ? ` · ${meta.address}` : ""}</span>
        <span style={{ flex: 1 }} />
        <Link to="/" style={{ opacity: 0.7 }}>Open the configurator →</Link>
      </div>
      <AstralApp />
    </div>
  );
}
