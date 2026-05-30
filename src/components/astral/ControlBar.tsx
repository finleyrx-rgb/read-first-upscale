// ControlBar — Plan/Elevation/Section/Detail + layer + face/cut + unit toggles.

import { useAstral } from "@/lib/astral/store";
import type {
  CutKey, FaceKey, LayerKey, ViewKey,
} from "@/lib/astral/constants";

type Pill<T extends string> = readonly (readonly [T, string])[];

function PillRow<T extends string>({
  items, current, onPick, small,
}: { items: Pill<T>; current: T; onPick: (k: T) => void; small?: boolean }) {
  return (
    <div className="astral-pillrow">
      {items.map(([k, label]) => (
        <div
          key={k}
          className={`astral-tab${small ? " sm" : ""}${current === k ? " on" : ""}`}
          onClick={() => onPick(k)}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

const VIEWS: Pill<ViewKey> = [
  ["plan", "Plan"], ["elevation", "Elevation"], ["section", "Section"], ["detail", "Detail"],
] as const;
const LAYERS: Pill<LayerKey> = [
  ["arch", "Architectural"], ["framing", "Framing"], ["foundation", "Concrete"],
] as const;
const FACES: Pill<FaceKey> = [
  ["front", "Front"], ["back", "Back"], ["left", "Left"], ["right", "Right"],
] as const;
const CUTS: Pill<CutKey> = [
  ["cross", "A–A cross"], ["long", "B–B long"],
] as const;

export function ControlBar() {
  const view = useAstral((s) => s.view);
  const layer = useAstral((s) => s.layer);
  const face = useAstral((s) => s.face);
  const cut = useAstral((s) => s.cut);
  const unit = useAstral((s) => s.unit);
  const set = useAstral((s) => s.set);
  const patch = useAstral((s) => s.patch);

  return (
    <div className="bar">
      <div className="astral-ctrlrow">
        <PillRow items={VIEWS} current={view} onPick={(k) => set("view", k)} />
        <div
          className="astral-tab unit"
          title="switch units"
          onClick={() => set("unit", unit === "m" ? "mm" : "m")}
        >
          {unit}
        </div>
      </div>

      <div className="astral-ctrlrow">
        <span className="astral-ctrllab">layer</span>
        <PillRow items={LAYERS} current={layer} onPick={(k) => set("layer", k)} small />
      </div>

      {view === "elevation" && (
        <div className="astral-ctrlrow">
          <span className="astral-ctrllab">face</span>
          <PillRow items={FACES} current={face} onPick={(k) => patch({ face: k })} small />
        </div>
      )}
      {view === "section" && (
        <div className="astral-ctrlrow">
          <span className="astral-ctrllab">cut</span>
          <PillRow items={CUTS} current={cut} onPick={(k) => patch({ cut: k })} small />
        </div>
      )}
    </div>
  );
}
