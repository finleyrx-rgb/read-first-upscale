// Inspector — shows the selected model node with editable params + derived info.

import { useAstral } from "@/lib/astral/store";
import { buildModel } from "@/lib/astral/model";
import { useMemo } from "react";
import { DimInput, OptRow } from "./form-primitives";
import { WALLNAME, ROOF_FORMS, type WallKey } from "@/lib/astral/constants";
import { defaultHead, defaultSill, overlappingOpeningIds } from "@/lib/astral/store";
import { maxHead, openingHead, openingSill } from "@/lib/astral/geom";
import { WALL_TYPES, WALL_TYPE_STYLES } from "@/lib/astral/wallTypes";

export function Inspector() {
  const S = useAstral((s) => s);
  const sel = S.sel;
  const M = useMemo(() => buildModel(S), [S]);
  if (!sel || !M.byId[sel]) return null;
  const n = M.byId[sel];

  return (
    <div className="astral-insp">
      <div className="ih">
        <div>
          <div className="ty">{n.type}</div>
          <div className="t">{n.name || n.type}</div>
        </div>
        <div className="x" onClick={() => S.setSel(null)}>✕ deselect</div>
      </div>

      {["Wall", "Building", "RoofSystem", "Slab", "Opening"].includes(n.type) && (
        <button className="astral-btn" style={{ fontSize: 12, padding: "8px 14px", marginBottom: 6 }}
          onClick={() => { S.setDetailFor(sel); S.set("view", "detail"); }}>
          ⊕ Construction detail
        </button>
      )}

      {n.type === "Building" && (
        <>
          <DimInput label="Length" getMM={() => S.L} setMM={(v) => S.set("L", v)} minMM={2000} maxMM={20000} />
          <DimInput label="Width" getMM={() => S.W} setMM={(v) => S.set("W", v)} minMM={2000} maxMM={12000} />
          <DimInput label="Stud height" getMM={() => S.studH} setMM={(v) => S.set("studH", v)} minMM={2400} maxMM={3600} />
          <OptRow label="Stud spacing" values={[400, 600] as const} current={S.spacing} onPick={(v) => S.set("spacing", v)} />
          <OptRow label="Units" values={[1, 2, 3] as const} current={S.units}
            onPick={(v) => S.set("units", v)} />
          {S.units > 1 && (
            <div className="astral-muted" style={{ fontSize: 11, marginTop: -4 }}>
              Party walls split the footprint into {S.units} equal bays along the length. Each unit ≈ {Math.round(S.L / S.units)}mm.
            </div>
          )}
        </>
      )}
      {n.type === "Slab" && (
        <OptRow label="Foundation" values={["Concrete slab", "Timber piles"] as const}
          current={S.found} onPick={(v) => S.set("found", v)} />
      )}
      {n.type === "RoofSystem" && (
        <>
          <OptRow label="Form" values={ROOF_FORMS} current={S.roof} onPick={(v) => S.set("roof", v)} />
          {S.roof === "Flat" && (
            <OptRow label="Parapet" values={["No", "Yes"] as const}
              current={S.parapet ? "Yes" : "No"}
              onPick={(v) => S.set("parapet", v === "Yes")} />
          )}
          <OptRow label="Covering" values={["Colorsteel corrugate", "Colorsteel tray", "Membrane", "Tile"] as const}
            current={S.cover} onPick={(v) => S.set("cover", v)} />
          <OptRow label="Structure" values={["Prefab trusses", "Cut roof"] as const}
            current={S.struct} onPick={(v) => S.set("struct", v)} />
        </>
      )}
      {n.type === "Opening" && (() => {
        const o = S.openings.find((z) => `opening-${z.id}` === sel);
        if (!o) return null;
        const head = openingHead(o, S.studH);
        const sill = openingSill(o);
        const hMax = maxHead(o.width, S.studH);
        const headOver = head > hMax;
        const sillOver = sill >= head - 200;
        const overlaps = overlappingOpeningIds(S.openings).has(o.id);
        const wallLenMM = (o.wall === "N" || o.wall === "S") ? S.L : S.W;
        const overflow = o.off - o.width / 2 < 0 || o.off + o.width / 2 > wallLenMM;
        return (
          <>
            <OptRow label="Type" values={["Garage", "Door", "Window"] as const}
              current={o.kind}
              onPick={(v) => S.updateOpening(o.id, {
                kind: v,
                head: defaultHead(v, S.studH),
                sill: defaultSill(v),
              })} />
            <OptRow label="Wall" values={(["S", "N", "W", "E"] as const).map((w) => WALLNAME[w])}
              current={WALLNAME[o.wall]}
              onPick={(v) => {
                const wl = (Object.keys(WALLNAME) as WallKey[]).find((k) => WALLNAME[k] === v);
                if (wl) S.updateOpening(o.id, { wall: wl });
              }} />
            <DimInput label="Width" getMM={() => o.width} setMM={(v) => S.updateOpening(o.id, { width: v })} minMM={400} maxMM={7000} />
            <DimInput label="Set-out to centre" getMM={() => o.off} setMM={(v) => S.updateOpening(o.id, { off: v })} minMM={0} maxMM={20000} />
            <DimInput label="Head (top AFFL)" getMM={() => head}
              setMM={(v) => S.updateOpening(o.id, { head: v })}
              minMM={600} maxMM={Math.max(600, S.studH - 90)} />
            {o.kind === "Window" && (
              <DimInput label="Sill (bottom AFFL)" getMM={() => sill}
                setMM={(v) => S.updateOpening(o.id, { sill: v })}
                minMM={0} maxMM={Math.max(0, head - 200)} />
            )}
            {(headOver || sillOver || overlaps || overflow) && (
              <div className="astral-muted" style={{ fontSize: 11, color: "#b4472d", marginTop: 4 }}>
                {headOver && <>⚠ Head {head} exceeds {hMax} (studH − lintel − top plate). Lower head or use engineered design.<br /></>}
                {sillOver && <>⚠ Sill must sit at least 200mm below the head.<br /></>}
                {overlaps && <>⚠ Overlaps another opening on this wall — move or resize.<br /></>}
                {overflow && <>⚠ Extends past the wall ends — reduce width or move the set-out.</>}
              </div>
            )}
          </>
        );
      })()}
      {n.type === "Partition" && (() => {
        const p = S.parts.find((z) => `part-${z.id}` === sel);
        if (!p) return null;
        const runMax = p.dir === "Across width" ? S.W : S.L;
        const posMax = p.dir === "Across width" ? S.L : S.W;
        return (
          <>
            <OptRow label="Direction" values={["Across width", "Along length"] as const} current={p.dir}
              onPick={(v) => S.updatePartition(p.id, { dir: v, start: 0, len: v === "Across width" ? S.W : S.L })} />
            <DimInput label="Position offset" getMM={() => p.off} setMM={(v) => S.updatePartition(p.id, { off: v })} minMM={0} maxMM={posMax} />
            <DimInput label="Start" getMM={() => p.start} setMM={(v) => S.updatePartition(p.id, { start: v })} minMM={0} maxMM={runMax} />
            <DimInput label="Length" getMM={() => p.len} setMM={(v) => S.updatePartition(p.id, { len: v })} minMM={200} maxMM={runMax} />
          </>
        );
      })()}
      {n.type === "Wall" && (
        <p className="astral-muted" style={{ fontSize: 12 }}>
          Walls derive from the building — edit size via the Building.
        </p>
      )}

      {Object.keys(n.derived).length > 0 && (
        <>
          <div className="sub2">Derived sub-elements</div>
          {Object.entries(n.derived).map(([k, v]) => (
            <div key={k} className="drow">
              <span>{k}</span>
              <b>{typeof v === "object" ? JSON.stringify(v).replace(/[{}"]/g, "").replace(/,/g, ", ") : String(v)}</b>
            </div>
          ))}
        </>
      )}

      {n.compliance.length > 0 && (
        <>
          <div className="sub2">Compliance</div>
          {n.compliance.map((c) => (
            <div key={c.rule} className="drow">
              <span>
                {c.rule} — {c.value}
                <br />
                <span className="astral-muted" style={{ fontSize: 11 }}>{c.basis}</span>
              </span>
              <span className={`astral-tag ${c.status === "sed" ? "sed" : "ok"}`}>{c.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
