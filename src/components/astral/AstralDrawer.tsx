// Astral agent — slide-out chat drawer. Accessible from any view.

import { useEffect, useRef } from "react";
import { useAgent, type ChatMessage } from "@/lib/astral/agent/client";

function actionLabel(a: { verb: string } & Record<string, unknown>): string {
  const parts: string[] = [a.verb];
  for (const [k, v] of Object.entries(a)) {
    if (k === "verb") continue;
    parts.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  return parts.join(" ");
}

function Bubble({ m, onRewind }: { m: ChatMessage; onRewind: (id: string) => void }) {
  const isUser = m.role === "user";
  return (
    <div className={`astral-msg ${isUser ? "u" : "a"}`}>
      <div className="b">
        {m.pending ? <em className="astral-muted">{m.content}</em> : m.content}
      </div>
      {m.actions && m.actions.length > 0 && (
        <details className="astral-acts" open>
          <summary>{m.actions.length} action{m.actions.length === 1 ? "" : "s"} applied</summary>
          <ul>
            {m.actions.map((a, i) => (
              <li key={i}><code>{actionLabel(a as never)}</code></li>
            ))}
          </ul>
          {m.snapshot && (
            <button className="astral-btn ghost sm" onClick={() => onRewind(m.id)}>
              ↶ Rewind to before this turn
            </button>
          )}
        </details>
      )}
      {m.error && <div className="astral-msg-err">⚠ {m.error}</div>}
    </div>
  );
}

export function AstralDrawer({ projectKey }: { projectKey: string }) {
  const open = useAgent((s) => s.open);
  const busy = useAgent((s) => s.busy);
  const messages = useAgent((s) => s.messages);
  const draft = useAgent((s) => s.draft);
  const toggle = useAgent((s) => s.toggle);
  const ask = useAgent((s) => s.ask);
  const setDraft = useAgent((s) => s.setDraft);
  const rewindTo = useAgent((s) => s.rewindTo);
  const loadHistory = useAgent((s) => s.loadHistory);
  const saveHistory = useAgent((s) => s.saveHistory);
  const clear = useAgent((s) => s.clear);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Per-project history persistence.
  useEffect(() => { loadHistory(projectKey); }, [projectKey, loadHistory]);
  useEffect(() => { saveHistory(projectKey); }, [messages, projectKey, saveHistory]);

  // Autoscroll on new message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, busy]);

  // Focus textarea when drawer opens.
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    ask(draft);
  }

  return (
    <>
      <button
        className="astral-agent-fab"
        type="button"
        aria-label="Ask Astral"
        onClick={() => toggle()}
        title="Ask Astral (the AI agent)"
      >
        ✦ Astral
      </button>
      <aside className={`astral-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <header className="astral-drawer-h">
          <div>
            <div className="astral-drawer-t">Astral · AI agent</div>
            <div className="astral-muted" style={{ fontSize: 11 }}>
              NZS 3604 / E2 aware · strict action grammar
            </div>
          </div>
          <div className="astral-drawer-tools">
            <button className="astral-btn ghost sm" onClick={clear} title="Clear chat">⟲</button>
            <button className="astral-btn ghost sm" onClick={() => toggle(false)} title="Close">✕</button>
          </div>
        </header>
        <div className="astral-drawer-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="astral-empty">
              <p>Ask Astral to change the model — every action lands as a confirmable patch in the timeline.</p>
              <ul>
                <li>"Make this a 6×4 sleepout"</li>
                <li>"Add a 1500mm window on the north wall at 2000mm"</li>
                <li>"Switch to framing plan"</li>
                <li>"Why is this wall flagged SED?"</li>
              </ul>
            </div>
          )}
          {messages.map((m) => <Bubble key={m.id} m={m} onRewind={rewindTo} />)}
        </div>
        <form className="astral-drawer-form" onSubmit={submit}>
          <textarea
            ref={inputRef}
            rows={2}
            value={draft}
            placeholder={busy ? "Astral is working…" : "Ask Astral…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e as unknown as React.FormEvent);
              }
            }}
            disabled={busy}
          />
          <button className="astral-btn" type="submit" disabled={busy || !draft.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </form>
      </aside>
    </>
  );
}
