// Dream-mode workspace: typology cards, free-form moodboard, intent panel.
// Lives alongside (not inside) the Build configurator.

import { useEffect, useRef, useState } from "react";
import { useAstral } from "@/lib/astral/store";
import {
  TYPOLOGIES, SPATIAL_QUALITIES, useDream, crystallise, canCrystallise,
  type DreamReference,
} from "@/lib/astral/dream";

function TypologyCard({ t, index, selected, onSelect }: {
  t: typeof TYPOLOGIES[number]; index: number; selected: boolean; onSelect: () => void;
}) {
  return (
    <button type="button" className={`dream-typ${selected ? " sel" : ""}`} onClick={onSelect}>
      <div className="dream-typ-row">
        <span className="dream-typ-num">{String(index + 1).padStart(2, "0")}</span>
        <svg className="dream-typ-glyph" viewBox="0 0 64 40" aria-hidden="true">
          <path d={t.glyph} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div className="dream-typ-ttl">{t.title}</div>
      <div className="dream-typ-chips">{t.qualities.map((q) => <span key={q}>{q}</span>)}</div>
      <div className="dream-typ-note">{t.notes}</div>
    </button>
  );
}

function Moodboard() {
  const refs = useDream((s) => s.references);
  const add = useDream((s) => s.addReference);
  const update = useDream((s) => s.updateReference);
  const remove = useDream((s) => s.removeReference);
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const rect = boardRef.current?.getBoundingClientRect();
    const x = (e.clientX - (rect?.left ?? 0)) - 80;
    const y = (e.clientY - (rect?.top ?? 0)) - 80;
    const files = Array.from(e.dataTransfer.files ?? []);
    files.forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        add({ kind: "photo", src: String(reader.result), x, y, w: 200, h: 160 });
      };
      reader.readAsDataURL(f);
    });
  }

  function addNote() {
    const rect = boardRef.current?.getBoundingClientRect();
    add({
      kind: "note", text: "New note", x: (rect?.width ?? 600) / 2 - 90, y: 40,
      w: 180, h: 110,
    });
  }

  function startDrag(e: React.PointerEvent, r: DreamReference) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setDrag({ id: r.id, dx: e.clientX - r.x, dy: e.clientY - r.y });
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    update(drag.id, { x: e.clientX - drag.dx, y: e.clientY - drag.dy });
  }
  function endDrag() { setDrag(null); }

  return (
    <div
      ref={boardRef}
      className="dream-board"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onPointerMove={onMove}
      onPointerUp={endDrag}
    >
      <div className="dream-board-tools">
        <button type="button" className="astral-btn ghost sm" onClick={addNote}>+ Note</button>
        <span className="astral-muted" style={{ fontSize: 11 }}>
          Drop images here · drag to arrange
        </span>
      </div>
      {refs.length === 0 && (
        <div className="dream-board-empty">
          <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, color: "#3c4a47" }}>
            Begin with a feeling.
          </p>
          <p className="astral-muted" style={{ fontSize: 12 }}>
            Drag photos here, jot a note, pick a typology.
          </p>
        </div>
      )}
      {refs.map((r) => (
        <div
          key={r.id}
          className={`dream-ref ${r.kind}`}
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          onPointerDown={(e) => startDrag(e, r)}
        >
          {r.kind === "note" ? (
            <textarea
              value={r.text ?? ""}
              onChange={(e) => update(r.id, { text: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : r.src ? (
            <img src={r.src} alt={r.caption ?? ""} draggable={false} />
          ) : null}
          <button
            type="button"
            className="dream-ref-rm"
            onClick={(e) => { e.stopPropagation(); remove(r.id); }}
            onPointerDown={(e) => e.stopPropagation()}
          >✕</button>
        </div>
      ))}
    </div>
  );
}

function IntentPanel() {
  const intent = useDream((s) => s.intent);
  const qualities = useDream((s) => s.spatialQualities);
  const typologyId = useDream((s) => s.typologyId);
  const setIntent = useDream((s) => s.setIntent);
  const toggleQ = useDream((s) => s.toggleQuality);
  const typo = TYPOLOGIES.find((t) => t.id === typologyId);
  const enabled = canCrystallise();

  return (
    <div className="dream-side dream-intent">
      <h3>What are you dreaming?</h3>
      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="What is this for? Who is it for? What feeling do you want?"
        rows={5}
      />
      <div className="dream-section-h">Spatial qualities</div>
      <div className="dream-q-chips">
        {SPATIAL_QUALITIES.map((q) => (
          <button
            key={q}
            type="button"
            className={`dream-chip${qualities.includes(q) ? " on" : ""}`}
            onClick={() => toggleQ(q)}
          >{q}</button>
        ))}
      </div>
      {typo && (
        <>
          <div className="dream-section-h">Selected typology</div>
          <div className="dream-typ-mini">
            <svg viewBox="0 0 64 40" aria-hidden="true">
              <path d={typo.glyph} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span>{typo.title}</span>
          </div>
        </>
      )}
      <button
        type="button"
        className="dream-crystallise"
        disabled={!enabled}
        onClick={() => {
          const r = crystallise();
          if (!r.ok) alert(r.message);
        }}
        title={enabled ? "Translate this dream into a starting build" : "Pick a typology, write intent, or add 3+ moodboard items"}
      >
        ✦ Crystallise → Build
      </button>
      <p className="astral-muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
        Concept synthesis — the agent will propose an initial buildable model,
        and you can refine it in Build mode.
      </p>
    </div>
  );
}

function TypologyRail() {
  const typologyId = useDream((s) => s.typologyId);
  const setTypology = useDream((s) => s.setTypology);
  return (
    <div className="dream-side dream-typrail">
      <h3>Typologies</h3>
      <p className="astral-muted" style={{ fontSize: 12, marginTop: 0 }}>
        Pick a starting shape. You can refine it later.
      </p>
      <div className="dream-typ-grid">
        {TYPOLOGIES.map((t) => (
          <TypologyCard
            key={t.id}
            t={t}
            selected={typologyId === t.id}
            onSelect={() => setTypology(typologyId === t.id ? null : t.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function DreamWorkspace() {
  const hydrate = useDream((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  return (
    <div className="dream-root">
      <TypologyRail />
      <Moodboard />
      <IntentPanel />
    </div>
  );
}

export function WelcomeCard({ onDismiss }: { onDismiss: () => void }) {
  const patch = useAstral((s) => s.patch);
  const loadTemplate = useAstral((s) => s.loadTemplate);
  return (
    <div className="dream-welcome-backdrop" onClick={onDismiss}>
      <div className="dream-welcome" onClick={(e) => e.stopPropagation()}>
        <h1>Welcome to <em>Astral</em>.</h1>
        <p>Start from a feeling, a sketch, or a template.</p>
        <div className="dream-welcome-opts">
          <button type="button" onClick={() => { patch({ mode: "dream" }); onDismiss(); }}>
            <span className="ic">✦</span>
            <span className="t">I'm dreaming</span>
            <span className="s">Open a moodboard and explore</span>
          </button>
          <button type="button" onClick={() => { patch({ mode: "build" }); onDismiss(); }}>
            <span className="ic">✎</span>
            <span className="t">I have a sketch</span>
            <span className="s">Upload and transcribe it</span>
          </button>
          <button type="button" onClick={() => { loadTemplate(0); patch({ mode: "build" }); onDismiss(); }}>
            <span className="ic">▢</span>
            <span className="t">I want to start building</span>
            <span className="s">Loads a default 10×8 garage</span>
          </button>
        </div>
        <button type="button" className="dream-welcome-skip" onClick={onDismiss}>Skip</button>
      </div>
    </div>
  );
}
