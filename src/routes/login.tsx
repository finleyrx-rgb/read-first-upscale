// /login — email + password and Google (via Lovable broker).

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · Project Astral" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [loading, user, nav]);

  const onEmail = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      }
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (r.error) setErr(String((r.error as Error).message ?? r.error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--astral-pa, #fafaf7)",
        padding: 24,
        fontFamily: "var(--astral-mono, ui-sans-serif)",
      }}
    >
      <div
        style={{
          width: 360,
          background: "#fff",
          border: "1px solid var(--astral-line, #ddd)",
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>
          Project <em>Astral</em>
        </h1>
        <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 16px" }}>
          {mode === "signin"
            ? "Sign in to load and save your projects."
            : "Create an account to save projects."}
        </p>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Continue with Google
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            opacity: 0.5,
            margin: "12px 0",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#ddd" }} /> OR{" "}
          <div style={{ flex: 1, height: 1, background: "#ddd" }} />
        </div>

        <form onSubmit={onEmail} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11 }}>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ fontSize: 11 }}>
            Password
            <input
              required
              type="password"
              minLength={8}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
          </label>
          {err && <div style={{ color: "#c25a3a", fontSize: 11 }}>{err}</div>}
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "10px 12px",
              background: "#1d2a2a",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          style={{
            marginTop: 12,
            background: "transparent",
            border: 0,
            fontSize: 11,
            opacity: 0.7,
            cursor: "pointer",
          }}
        >
          {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>

        <div style={{ marginTop: 16, fontSize: 11 }}>
          <Link to="/" style={{ opacity: 0.6 }}>
            ← back to the configurator
          </Link>
        </div>
      </div>
    </div>
  );
}
