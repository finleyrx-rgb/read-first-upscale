// SectionPanel — step rail + per-step forms (Site, Footprint, Roof, Openings,
// Layout, Finishes, Resolve, Outputs). Reads/writes the Zustand store.

import { useAstral } from "@/lib/astral/store";
import { useShallow } from "zustand/react/shallow";
import {
  CLAD, ROOFC, STEPS, STEP_BLURBS, STEP_TITLES, TEMPLATES,
  WALLNAME, WALLTYPE_KEYS, WALLTYPES, type WallKey,
} from "@/lib/astral/constants";
import { DimInput, OptRow, SliderRow, Swatches } from "./form-primitives";
import {
  bracingRule, footRule, lintelRule, qtys, roofRule, studRule, tieRule,
  type RuleResult,
} from "@/lib/astral/model";

function fmt(v: number) { return Math.round(v).toLocaleString(); }
const wallLen = (S: { L: number; W: number }, w: WallKey) => (w === "N" || w === "S" ? S.L : S.W);

function StepSite() {
  const s = useAstral(useShallow((st) => ({
    type: st.type, wind: st.wind, found: st.found,
  })));
  const set = useAstral((st) => st.set);
  const applyType = useAstral((st) => st.applyType);
  const loadTemplate = useAstral((st) => st.loadTemplate);
  return (
    <>
      <div className="astral-q">
        <label>Start from a template</label>
        <div className="astral-opts">
          {TEMPLATES.map((tp, i) => (
            <div key={tp.n} className="astral-opt" onClick={() => loadTemplate(i)}>{tp.n}</div>
          ))}
        </div>
      </div>
      <OptRow label="Building type" values={["Garage", "Sleepout", "Cabin", "Studio", "Workshop"] as const}
        current={s.type} onPick={applyType} />
      <OptRow label="Wind / exposure" values={["Medium", "High", "Very High", "Extra High", "Cyclonic (SED)"] as const}
        current={s.wind} onPick={(v) => set("wind", v)} />
      <OptRow label="Foundation" values={["Concrete slab", "Timber piles"] as const}
        current={s.found} onPick={(v) => set("found", v)} />
    </>
  );
}

function StepFootprint() {
  const L = useAstral((s) => s.L);
  const W = useAstral((s) => s.W);
  const studH = useAstral((s) => s.studH);
  const spacing = useAstral((s) => s.spacing);
  const set = useAstral((s) => s.set);
  return (
    <>
      <div className="astral-two">
        <DimInput label="Length" getMM={() => L} setMM={(v) => set("L", v)} minMM={2000} maxMM={20000} />
        <DimInput label="Width" getMM={() => W} setMM={(v) => set("W", v)} minMM={2000} maxMM={12000} />
      </div>
      <DimInput label="Stud height" getMM={() => studH} setMM={(v) => set("studH", v)} minMM={2400} maxMM={3600} />
      <OptRow label="Stud spacing (c/c)" values={[400, 600] as const} current={spacing}
        onPick={(v) => set("spacing", v)} />
    </>
  );
}

function StepRoof() {
  const s = useAstral(useShallow((st) => ({
    roof: st.roof, pitch: st.pitch, cover: st.cover, struct: st.struct, roofCol: st.roofCol, eave: st.eave,
  })));
  const set = useAstral((st) => st.set);
  return (
    <>
      <OptRow label="Roof form" values={["Gable", "Hip", "Mono", "Flat"] as const} current={s.roof}
        onPick={(v) => set("roof", v)} />
      {s.roof !== "Flat" && (
        <SliderRow label="Pitch" value={s.pitch} min={3} max={35} onChange={(v) => set("pitch", v)} />
      )}
      <OptRow label="Covering" values={["Colorsteel corrugate", "Colorsteel tray", "Membrane", "Tile"] as const}
        current={s.cover} onPick={(v) => set("cover", v)} />
      <OptRow label="Structure" values={["Prefab trusses", "Cut roof"] as const}
        current={s.struct} onPick={(v) => set("struct", v)} />
      <Swatches label="Roof colour" list={ROOFC} current={s.roofCol} onPick={(n) => set("roofCol", n)} />
      <DimInput label="Eave overhang" getMM={() => s.eave} setMM={(v) => set("eave", v)} minMM={0} maxMM={900} />
      <p className="astral-muted" style={{ fontSize: 12 }}>
        Tip: switch to Front / End tabs above the drawing to see it.
      </p>
    </>
  );
}

function StepOpenings() {
  const openings = useAstral((s) => s.openings);
  const joinery = useAstral((s) => s.joinery);
  const L = useAstral((s) => s.L);
  const W = useAstral((s) => s.W);
  const add = useAstral((s) => s.addOpening);
  const upd = useAstral((s) => s.updateOpening);
  const rm = useAstral((s) => s.removeOpening);
  const set = useAstral((s) => s.set);
  return (
    <>
      <p className="astral-muted" style={{ fontSize: 13 }}>
        Add openings, choose the wall, and type a set-out measurement to place each one.
      </p>
      {openings.map((o) => {
        const wlen = wallLen({ L, W }, o.wall);
        return (
          <div key={o.id} className="astral-openrow">
            <div className="top">
              <div className="kind">
                {(["Garage", "Door", "Window"] as const).map((k) => (
                  <div key={k} className={`astral-mini${o.kind === k ? " sel" : ""}`}
                    onClick={() => upd(o.id, { kind: k, width: k === "Garage" ? 5000 : k === "Window" ? 1200 : 810 })}>
                    {k}
                  </div>
                ))}
              </div>
              <button className="astral-rm" onClick={() => rm(o.id)}>remove</button>
            </div>
            <div className="astral-lab">Wall</div>
            <div className="astral-opts">
              {(["S", "N", "W", "E"] as const).map((wl) => (
                <div key={wl} className={`astral-opt${o.wall === wl ? " sel" : ""}`}
                  style={{ padding: "6px 10px", fontSize: 12 }}
                  onClick={() => upd(o.id, { wall: wl })}>
                  {WALLNAME[wl]}
                </div>
              ))}
            </div>
            <div className="astral-lab">{`Set-out to centre · wall = ${fmt(wlen)}mm`}</div>
            <DimInput getMM={() => o.off} setMM={(v) => upd(o.id, { off: Math.max(0, Math.min(wlen, v)) })}
              minMM={0} maxMM={20000} />
            <div className="astral-lab">Width</div>
            <DimInput getMM={() => o.width} setMM={(v) => upd(o.id, { width: Math.max(400, Math.min(7000, v)) })}
              minMM={400} maxMM={7000} />
          </div>
        );
      })}
      <button className="astral-addbtn" onClick={add}>+ Add opening</button>
      <OptRow label="Joinery timber" values={["Fiji mahogany", "Cedar", "Aluminium", "Pine"] as const}
        current={joinery} onPick={(v) => set("joinery", v)} />
    </>
  );
}

function StepLayout() {
  const parts = useAstral((s) => s.parts);
  const L = useAstral((s) => s.L);
  const W = useAstral((s) => s.W);
  const add = useAstral((s) => s.addPartition);
  const upd = useAstral((s) => s.updatePartition);
  const rm = useAstral((s) => s.removePartition);
  return (
    <>
      <p className="astral-muted" style={{ fontSize: 13 }}>
        Add internal walls to split the space — placed by measurement.
      </p>
      {parts.map((p) => {
        const acrossW = p.dir === "Across width";
        const posMax = acrossW ? L : W;
        const runMax = acrossW ? W : L;
        return (
          <div key={p.id} className="astral-openrow">
            <div className="top">
              <div className="kind">
                {(["Across width", "Along length"] as const).map((k) => (
                  <div key={k} className={`astral-mini${p.dir === k ? " sel" : ""}`}
                    onClick={() => upd(p.id, { dir: k, start: 0, len: k === "Across width" ? W : L })}>
                    {k}
                  </div>
                ))}
              </div>
              <button className="astral-rm" onClick={() => rm(p.id)}>remove</button>
            </div>
            <div className="astral-lab">Position offset</div>
            <DimInput getMM={() => p.off} setMM={(v) => upd(p.id, { off: Math.max(0, Math.min(posMax, v)) })}
              minMM={0} maxMM={posMax} />
            <div className="astral-lab">Start + length</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <DimInput getMM={() => p.start} setMM={(v) => {
                const start = Math.max(0, Math.min(runMax - 200, v));
                const len = p.start + p.len > runMax ? runMax - start : p.len;
                upd(p.id, { start, len });
              }} minMM={0} maxMM={runMax} />
              <DimInput getMM={() => p.len} setMM={(v) => upd(p.id, { len: Math.max(200, Math.min(runMax - p.start, v)) })}
                minMM={200} maxMM={runMax} />
            </div>
            <div className="astral-lab">Wall type</div>
            <div className="astral-opts">
              {WALLTYPE_KEYS.map((k) => (
                <div key={k} className={`astral-opt${p.type === k ? " sel" : ""}`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => upd(p.id, { type: k })}>
                  {WALLTYPES[k].label}
                </div>
              ))}
            </div>
            <div className="astral-lab">Doorway?</div>
            <div className="astral-opts">
              {(["Yes", "No"] as const).map((v) => (
                <div key={v} className={`astral-opt${(p.door ? "Yes" : "No") === v ? " sel" : ""}`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => upd(p.id, { door: v === "Yes" })}>
                  {v}
                </div>
              ))}
            </div>
            {p.door && (
              <>
                <div className="astral-lab">Door set-out + width</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <DimInput getMM={() => p.doorOff} setMM={(v) => upd(p.id, { doorOff: Math.max(0, Math.min(runMax, v)) })}
                    minMM={0} maxMM={runMax} />
                  <DimInput getMM={() => p.doorW} setMM={(v) => upd(p.id, { doorW: Math.max(600, Math.min(1200, v)) })}
                    minMM={600} maxMM={1200} />
                </div>
              </>
            )}
          </div>
        );
      })}
      <button className="astral-addbtn" onClick={add}>+ Add internal wall</button>
    </>
  );
}

function StepFinishes() {
  const s = useAstral(useShallow((st) => ({
    clad: st.clad, cladCol: st.cladCol, lining: st.lining, floor: st.floor, insul: st.insul,
  })));
  const set = useAstral((st) => st.set);
  return (
    <>
      <OptRow label="Exterior cladding" values={["Plaster system", "Weatherboard", "Ply + batten", "Fibre-cement"] as const}
        current={s.clad} onPick={(v) => set("clad", v)} />
      <Swatches label="Cladding colour" list={CLAD} current={s.cladCol} onPick={(n) => set("cladCol", n)} />
      <OptRow label="Interior lining" values={["Plywood", "Plasterboard", "None"] as const}
        current={s.lining} onPick={(v) => set("lining", v)} />
      <OptRow label="Floor finish" values={["Sealed / clear", "Epoxy", "Polished", "Bare"] as const}
        current={s.floor} onPick={(v) => set("floor", v)} />
      <OptRow label="Insulation" values={["None — open", "Ceiling only", "Walls + ceiling"] as const}
        current={s.insul} onPick={(v) => set("insul", v)} />
    </>
  );
}

function ResCard({ label, r }: { label: string; r: RuleResult }) {
  return (
    <div className="astral-res">
      <div className="rh">
        <span>{label}</span>
        {r.sed ? <span className="astral-tag sed">SED / by others</span> : <span className="astral-tag ok">in scope</span>}
      </div>
      <div className="rv">{r.v}</div>
      <div className="rn">{r.n}</div>
    </div>
  );
}

function StepResolve() {
  const S = useAstral((s) => s);
  const garage = [...S.openings].filter((o) => o.kind === "Garage").sort((a, b) => b.width - a.width)[0];
  const lintelMax = Math.max(810, ...S.openings.filter((o) => o.kind !== "Garage").map((o) => o.width), 0);
  return (
    <>
      <p className="astral-muted" style={{ fontSize: 13 }}>
        Worked out from your choices. Amber = an engineer or fabricator designs &amp; stamps it.
      </p>
      <ResCard label="Wall studs" r={studRule(S)} />
      <ResCard label="Garage door head" r={garage ? lintelRule(garage.width) : { v: "—", sed: false, n: "no garage door" }} />
      <ResCard label="Window / door lintels" r={lintelRule(lintelMax)} />
      <ResCard label="Roof structure" r={roofRule(S)} />
      <ResCard label="Bracing" r={bracingRule(S)} />
      <ResCard label="Tie-downs / fixings" r={tieRule(S)} />
      <ResCard label="Foundation" r={footRule(S)} />
    </>
  );
}

function StepOutputs() {
  const S = useAstral((s) => s);
  const q = qtys(S);
  return (
    <>
      <div className="astral-sechead">Build spec</div>
      <table className="astral-bom"><tbody>
        <tr><td>{S.type} · {(S.L / 1000)}×{(S.W / 1000)}m · {S.studH / 1000}m stud</td><td>{q.floorA} m²</td></tr>
        <tr><td>{S.roof} roof {S.pitch}° · {S.cover} · {S.roofCol}</td><td>{q.roofA} m²</td></tr>
        <tr><td>{S.clad} ({S.cladCol}) · {S.lining} · {S.floor}</td><td>{S.insul}</td></tr>
        <tr><td>Joinery: {S.joinery}</td><td>{S.openings.length} openings</td></tr>
        <tr><td>Exposure</td><td>{S.wind}</td></tr>
      </tbody></table>
      <div className="astral-sechead">Indicative materials</div>
      <table className="astral-bom">
        <thead><tr><th>Item</th><th>Qty</th></tr></thead>
        <tbody>
          <tr><td>Concrete (slab + thickenings)</td><td>{q.concrete} m³</td></tr>
          <tr><td>Mesh SE82</td><td>{q.mesh} sht</td></tr>
          <tr><td>Framing timber</td><td>{q.studsLm} lm</td></tr>
          <tr><td>Purlins</td><td>{q.purlinsLm} lm</td></tr>
          <tr><td>{S.cover}</td><td>{q.roofingM2} m²</td></tr>
          <tr><td>{S.clad}</td><td>{q.cladM2} m²</td></tr>
          <tr><td>{S.lining} lining</td><td>{q.liningM2} m²</td></tr>
        </tbody>
      </table>
      <div className="astral-sechead">Requirements to actualise</div>
      {["Engineered foundation + PS1", "Roof structure design + PS1 (fabricator)",
        "Garage door head / portal (engineer)", "Bracing design (engineer / P21)",
        "Cyclone fixing schedule (engineer)", "Cladding system spec (supplier)",
        "Consent pathway + producer statements"].map((t) => (
          <div key={t} className="astral-check"><span className="bx" /><span>{t}</span></div>
        ))}
      <button className="astral-btn" style={{ marginTop: 16 }} onClick={() => window.print()}>
        ⎙ Print / Save as PDF
      </button>
    </>
  );
}

export function SectionPanel() {
  const step = useAstral((s) => s.step);
  const setStep = useAstral((s) => s.setStep);

  return (
    <div className="astral-panel">
      <div className="astral-rail">
        {STEPS.flatMap((nm, i) => {
          const items = [];
          if (i === 6) items.push(<div key={`gap-${i}`} className="sctgap" style={{ flexBasis: "100%", height: 0 }} />);
          items.push(
            <div key={nm} className={`sct${i === step ? " on" : ""}`} onClick={() => setStep(i)}>
              {i + 1} {nm}
            </div>,
          );
          return items;
        })}
      </div>
      <div className="astral-stephead">
        <div className="kx">Step {step + 1} / {STEPS.length} · {STEPS[step]}</div>
        <h2>{STEP_TITLES[step]}</h2>
        <p>{STEP_BLURBS[step]}</p>
      </div>
      <div className="astral-body">
        {step === 0 && <StepSite />}
        {step === 1 && <StepFootprint />}
        {step === 2 && <StepRoof />}
        {step === 3 && <StepOpenings />}
        {step === 4 && <StepLayout />}
        {step === 5 && <StepFinishes />}
        {step === 6 && <StepResolve />}
        {step === 7 && <StepOutputs />}
      </div>
      <div className="astral-foot">
        <div className="astral-stat">{step === 6 ? "↑ computed, not asked" : ""}</div>
      </div>
    </div>
  );
}
