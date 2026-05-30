// Reusable form primitives for Astral step panels and inspector.
// Stateless — read/write goes through Zustand via callbacks.

import type { ReactNode } from "react";
import { useAstral } from "@/lib/astral/store";

export function OptRow<T extends string | number>({
  label, values, current, onPick, small,
}: {
  label: string;
  values: readonly T[];
  current: T;
  onPick: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className="astral-q">
      <label>{label}</label>
      <div className="astral-opts">
        {values.map((v) => (
          <div
            key={String(v)}
            className={`astral-opt${v === current ? " sel" : ""}`}
            style={small ? { padding: "6px 12px", fontSize: 12 } : undefined}
            onClick={() => onPick(v)}
          >
            {String(v)}
          </div>
        ))}
      </div>
    </div>
  );
}

function toDisplay(mm: number, unit: "m" | "mm") {
  return unit === "m" ? +(mm / 1000).toFixed(3) : Math.round(mm);
}
function fromDisplay(val: number, unit: "m" | "mm") {
  return Math.round(val * (unit === "m" ? 1000 : 1));
}

export function DimInput({
  label, getMM, setMM, minMM, maxMM,
}: {
  label?: string;
  getMM: () => number;
  setMM: (v: number) => void;
  minMM: number;
  maxMM: number;
}) {
  const unit = useAstral((s) => s.unit);
  const step = unit === "m" ? 0.1 : 10;
  return (
    <div className="astral-q">
      {label ? <label>{label}</label> : null}
      <div className="astral-num">
        <input
          type="number"
          value={toDisplay(getMM(), unit)}
          min={toDisplay(minMM, unit)}
          max={toDisplay(maxMM, unit)}
          step={step}
          onChange={(e) => {
            const mm = Math.max(minMM, Math.min(maxMM, fromDisplay(+e.target.value || 0, unit)));
            setMM(mm);
          }}
        />
        <span className="astral-stat">{unit}</span>
      </div>
    </div>
  );
}

export function SliderRow({
  label, value, min, max, onChange, suffix = "°",
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="astral-q">
      <label>{`${label} — ${value}${suffix}`}</label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export function Swatches<T extends { n: string; h: string }>({
  label, list, current, onPick,
}: {
  label: string; list: readonly T[]; current: string; onPick: (n: string) => void;
}) {
  return (
    <div className="astral-q">
      <label>{label}</label>
      <div className="astral-swwrap">
        {list.map((c) => (
          <div
            key={c.n}
            className={`astral-swatch${current === c.n ? " sel" : ""}`}
            style={{ background: c.h }}
            onClick={() => onPick(c.n)}
          >
            <span>{c.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="astral-q">{children}</div>;
}
