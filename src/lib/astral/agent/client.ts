// Astral agent — client store. Holds chat history + undo timeline per project,
// applies validated actions to the main Astral store, and surfaces a flash
// highlight on the canvas.

import { create } from "zustand";
import { useAstral, type AstralState } from "../store";
import { applyAction, type AgentAction } from "./grammar";
import { astralAgentTurn } from "../agent.functions";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Actions queued by the agent on this assistant turn. */
  actions?: AgentAction[];
  /** Snapshot taken BEFORE actions ran — used to rewind to this point. */
  snapshot?: Partial<AstralState>;
  ts: number;
  pending?: boolean;
  error?: string;
};

type AgentClientState = {
  open: boolean;
  busy: boolean;
  messages: ChatMessage[];
  /** Element id flashed on canvas after an action — auto-cleared. */
  flashId: string | null;
  /** Optional pre-seed text (e.g. from "Ask Astral about this" button). */
  draft: string;
};

type AgentClientActions = {
  toggle: (open?: boolean) => void;
  setDraft: (s: string) => void;
  loadHistory: (key: string) => void;
  saveHistory: (key: string) => void;
  clear: () => void;
  ask: (message: string) => Promise<void>;
  rewindTo: (messageId: string) => void;
  flash: (id: string | null) => void;
};

export type AgentClient = AgentClientState & AgentClientActions;

const HISTORY_KEY = "astral.agent.history.v1";
const SERIALIZABLE_KEYS: (keyof AstralState)[] = [
  "type", "wind", "found", "L", "W", "studH", "spacing", "eave",
  "roof", "pitch", "cover", "struct", "roofCol",
  "joinery", "clad", "cladCol", "lining", "floor", "insul",
  "units", "parapet", "wallTypes", "openings", "parts",
];

function snapshot(s: AstralState): Partial<AstralState> {
  const out: Partial<AstralState> = {};
  for (const k of SERIALIZABLE_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[k] = (s as any)[k];
  }
  // deep-clone arrays/objects so a later mutation doesn't leak in
  return JSON.parse(JSON.stringify(out)) as Partial<AstralState>;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const useAgent = create<AgentClient>((set, get) => ({
  open: false,
  busy: false,
  messages: [],
  flashId: null,
  draft: "",

  toggle: (open) => set((s) => ({ open: open ?? !s.open })),
  setDraft: (draft) => set({ draft }),
  flash: (flashId) => {
    set({ flashId });
    if (flashId && typeof window !== "undefined") {
      window.setTimeout(() => {
        if (useAgent.getState().flashId === flashId) set({ flashId: null });
      }, 2200);
    }
  },

  loadHistory: (key) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`${HISTORY_KEY}:${key}`);
      if (raw) set({ messages: JSON.parse(raw) as ChatMessage[] });
      else set({ messages: [] });
    } catch { /* noop */ }
  },
  saveHistory: (key) => {
    if (typeof window === "undefined") return;
    try {
      const msgs = get().messages.filter((m) => !m.pending).slice(-80);
      window.localStorage.setItem(`${HISTORY_KEY}:${key}`, JSON.stringify(msgs));
    } catch { /* noop */ }
  },
  clear: () => set({ messages: [] }),

  ask: async (message) => {
    if (!message.trim() || get().busy) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: message, ts: Date.now() };
    const pending: ChatMessage = {
      id: uid(), role: "assistant", content: "Thinking…", ts: Date.now(), pending: true,
    };
    set((s) => ({ messages: [...s.messages, userMsg, pending], busy: true, draft: "" }));

    const preSnap = snapshot(useAstral.getState() as AstralState);
    const history = get().messages
      .filter((m) => !m.pending && (m.role === "user" || m.role === "assistant"))
      .slice(-16)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const isDream = useAstral.getState().mode === "dream";

    try {
      let text = "";
      let error: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionsForLog: any[] = [];
      let highlight: string | null = null;

      if (isDream) {
        const { astralDreamTurn } = await import("../dreamAgent.functions");
        const { applyDreamAction } = await import("./dreamGrammar");
        const { useDream } = await import("../dream");
        const dreamSnap = JSON.parse(JSON.stringify(useDream.getState())) as Record<string, unknown>;
        const res = await astralDreamTurn({ data: { message, history, dream: dreamSnap } });
        text = res.text; error = res.error;
        for (const a of res.actions) {
          try { applyDreamAction(a); actionsForLog.push(a); }
          catch (e) { console.error("applyDreamAction failed", a, e); }
        }
      } else {
        const res = await astralAgentTurn({
          data: {
            message, history,
            state: snapshot(useAstral.getState() as AstralState) as Record<string, unknown>,
            selectedId: useAstral.getState().sel,
          },
        });
        text = res.text; error = res.error;
        const store = useAstral.getState();
        for (const a of res.actions) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = applyAction(store as any, a);
            if (r.highlight) highlight = r.highlight;
            actionsForLog.push(a);
          } catch (e) { console.error("applyAction failed", a, e); }
        }
      }

      const finalMsg: ChatMessage = {
        id: pending.id,
        role: "assistant",
        content: text || (actionsForLog.length ? "Done." : "—"),
        actions: actionsForLog,
        snapshot: !isDream && actionsForLog.length ? preSnap : undefined,
        ts: Date.now(),
        error,
      };
      set((s) => ({
        messages: s.messages.map((m) => (m.id === pending.id ? finalMsg : m)),
        busy: false,
      }));
      if (highlight) {
        useAstral.getState().setSel(highlight);
        get().flash(highlight);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const errMsg: ChatMessage = {
        id: pending.id, role: "assistant", content: `⚠ ${msg}`, error: msg, ts: Date.now(),
      };
      set((s) => ({
        messages: s.messages.map((m) => (m.id === pending.id ? errMsg : m)),
        busy: false,
      }));
    }
  },

  rewindTo: (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    if (!msg || !msg.snapshot) return;
    useAstral.getState().patch(msg.snapshot);
    // Truncate history at this message so the timeline reflects the rewind.
    set((s) => ({
      messages: s.messages.slice(0, s.messages.findIndex((m) => m.id === messageId)),
    }));
  },
}));
