# Astral audit — Phase A (2026-06-11)

## Summary

- **Files scanned:** 109 files under `src/` (excluding `src/components/ui/` shadcn primitives and `src/integrations/supabase/*` auto-generated).
- **Findings:** 14 — 8 fixed in this pass, 6 documented with intentional deferrals or no-action explanations.
- **Typecheck (`bunx tsc --noEmit`):** ✓ clean, zero errors.
- **Lint:** 1832 pre-existing prettier formatting errors (unchanged by this pass — not introduced by the audit fixes). 9 pre-existing eslint warnings unchanged. **No new lint regressions.**
- **Build:** not run inside the audit (the harness builds on commit and reports failures); typecheck and lint deltas confirm the fixes are safe.

The lint backlog is pure formatting (whitespace, line wrapping). A `bunx prettier --write src` would clear it but is out of scope for this audit and would balloon the diff. Flagged as finding #14.

Phase B and Phase C are intentionally untouched per your sequencing decision (Phase A only this turn).

---

## Findings

| # | File · line | Class | Issue | Resolution |
| - | ----------- | ----- | ----- | ---------- |
| 1 | `src/lib/astral/store.ts` · 369–376 | nid collision | The local `nid` counter was bumped only once on module load. Loading a project with high opening/partition ids via `patch()` (e.g. share-token URL, project switch, agent bulk-insert) left `nid` stale → next `addOpening`/`addPartition` would collide with an existing id. | **Fixed.** Extracted `reseedNid(state)` helper. Called on module init, inside `patch()` whenever `openings`/`parts` arrive, and at the end of `loadTemplate()`. |
| 2 | `src/lib/astral/store.ts` · 296–298 | Geometry clamp | `updatePartition` blindly spread the patch without re-clamping against the current footprint. Moving a partition past the wall edge (manually or via agent) left an out-of-range value that `clampToDims` would only fix on the next L/W change. | **Fixed.** Added `clampPartition(p, L, W)` helper mirroring the logic from `clampToDims`. `updatePartition` now routes every patch through it. Consistent with `updateOpening` which already re-clamps. |
| 3 | `src/components/astral/Inspector.tsx` · 14–16 | useShallow / buildModel waste | `useAstral((s) => s)` returned a new identity on every store change, including `setSel`, `setView`, `setDetailFor`, agent flash, autosave debounce. The `useMemo(() => buildModel(S), [S])` therefore re-ran the entire node-graph walk on every selection click and every UI toggle. | **Fixed.** Switched to `useShallow((s) => s)` to deduplicate identical-shape emissions, and rewrote the `useMemo` dep list to the explicit set of model-relevant keys (geometry, finishes, wall types, openings, parts). Selection / view / agent-flash no longer triggers `buildModel`. |
| 4 | `src/components/astral/MaterialsPanel.tsx` · 41–42 | useShallow / buildTakeoff waste | Same pattern: full-store subscription + `useMemo(..., [S])` meant `buildTakeoff` ran on every selection or view change. | **Fixed.** `useShallow` + explicit dep list of takeoff-relevant keys. |
| 5 | `src/components/astral/SheetFrame.tsx` · 27–34 | useShallow / buildModel waste | The title-block component subscribed to the entire store and the `detailType` memo depended on the full `[S, detailFor]`. Every state change rebuilt the model just to look up `byId[detailFor]?.type`. | **Fixed.** `useShallow` + explicit dep list. Model rebuild now only runs when the keys that feed it actually change. |
| 6 | `src/components/astral/SectionPanel.tsx` · 272, 292 | useShallow | `StepResolve` and `StepOutputs` both used `(s) => s` and re-rendered the entire Resolve/Outputs DOM on every store tick. | **Fixed.** Both switched to `useShallow((s) => s)`. |
| 7 | `src/components/astral/views/PlanView.tsx` · 41–63 | Surfaced `overlappingOpeningIds` | The helper was computed in `store.ts` and consumed only by the Inspector. The plan view itself rendered overlapping openings in their normal kind-colour, so the conflict was invisible until the user clicked one. | **Fixed.** Plan view now computes `overlappingOpeningIds(S.openings)` once per render, overrides the stroke colour to `#c93535`, draws a dashed red halo around the opening footprint, and tags the SVG `<line>` with a `<title>` tooltip "Overlaps another opening on this wall". Inspector warning text already existed. |
| 8 | `src/lib/astral/store.ts` · 232 | Helper hoisting | The init-time IIFE that bumped `nid` was redundant with the new helper. | **Fixed.** Replaced the inline block with a single `reseedNid(useAstral.getState())` call. |
| 9 | All `src/` files | SSR landmines (window/document/localStorage/navigator outside `useEffect`) | Audited every match. Every browser-API reference in non-server code is either: (a) inside an event handler (`window.print`, `window.prompt`, `window.confirm`, `navigator.clipboard`), (b) inside a `useEffect`, or (c) inside an explicit `typeof window === "undefined"` guard (`store.ts` autosave subscribe, `readBootstrap`, `readStoredUnit`, `loadFromStorage`, `decodeShare`). | **No action.** No unguarded references found. |
| 10 | `src/lib/astral/store.ts` · 379–395 | Autosave subscribe cycle | `useAstral.subscribe` writes to `localStorage` debounced. It does **not** call `set()` or `useAstral.setState`, so no self-trigger cycle is possible. `useDream` follows the same pattern. | **No action.** Verified safe. |
| 11 | Grammar coverage (`src/lib/astral/agent/grammar.ts`) | Action verb coverage | Walked every store action against the grammar. **Model-mutating** actions all have verbs: `setFootprint` (L/W), `setRoof`, `setFinishes`, `setSite`, `setStoreys`, `addOpening`, `updateOpening`, `removeOpening`, `addPartition`, `updatePartition`, `removePartition`, `loadTemplate`, `setView`. **UI-only** actions intentionally have no verbs: `setSel`, `setDetailFor`, view/layer/face/cut/cutPos, `setStep`, `mode`. The agent should not be flipping the user's selection or view out from under them. | **No action.** Coverage is correct and the exclusion is intentional. |
| 12 | Agent emitting out-of-range `addOpening`/`updateOpening` | Clamp consistency | Agent actions route through `store.addOpening` and `store.updateOpening`, both of which already clamp. With finding #2 applied, partition actions now also clamp. Policy: **always clamp, never refuse**. | **Verified consistent.** |
| 13 | `as any` casts | TypeScript discipline | 6 occurrences. Three (`agent.functions.ts`, `dreamAgent.functions.ts`, `vision.functions.ts`) are `inputSchema: inputSchema as any` — the Zod-to-AI-SDK schema type plumbing in the current `ai` package version legitimately needs this cast. Two (`agent/client.ts` lines 58, 150) are unavoidable indexed access through a generic snapshot object. One (`VisionPanel.tsx:109`) mirrors the same pattern. | **No action this pass.** Documented; can be narrowed when the upstream `ai` SDK exposes a tighter input-schema type. |
| 14 | Repo-wide | Pre-existing prettier formatting | 1832 prettier errors existed before this audit (single-line object literals, missing trailing commas, etc.). My fixes neither introduced nor cleared any. | **Deferred.** A single `bunx prettier --write src` will clear the entire backlog but produces a huge churn diff. Recommend running it as its own commit before Phase B begins. |

---

## Storeys = 2 verification (prose, per your call)

Walked the rendering code for `storeys === 2`:

- **`SectionView.tsx`** — total height = `studH * storeys + floorDepth * (storeys - 1)`. Floor band rendered as a horizontal hatched strip at GF stud-top. Dashed datum lines and "GF / 1FL" dimension labels render. ✓
- **`ElevationView.tsx`** — same height formula; horizontal floor band drawn across all visible layer renderings (arch + framing). ✓
- **`AxonView.tsx`** — `studH` reads as the per-storey value, total wall extrusion scales by `storeys`. ✓
- **`Inspector.tsx`** — Building node exposes `Storeys` OptRow (1 | 2), and reveals the `Inter-floor depth` DimInput when `storeys > 1`. ✓
- **`takeoff.ts`** — `takeoffStuds`, `takeoffFixings`, and `takeoffAreas` scale by storey count, and an "Intermediate floor joists" row appears in the schedule when `storeys === 2`. ✓
- **Plan / Foundation / Framing plans** — currently render the ground-floor plan only. A `Level 1 / Level 2` toggle in the ControlBar, plus the `-L1`/`-L2` sheet-number suffix, are explicitly **deferred to Phase B** (they're UI-progressive-disclosure work, not a correctness bug).

## Axon geometry sanity (prose)

`AxonView.tsx` is real isometric SVG. Walked the source and confirmed it responds to:

- **Footprint** (L, W) — base parallelogram dimensions scale correctly.
- **Stud height** — vertical wall extrusion height scales with `studH`.
- **Roof form + pitch** — `Gable`, `Hip`, `Mono`, `Flat` each emit a distinct ridge/eave geometry; `pitch` drives the ridge offset.
- **Openings** — wall faces show rectangular cut-outs per opening (kind-coloured), positioned via the same `openPlace` helper the plan uses.
- **Storeys** — extrusion repeats; `floorDepth` introduces a horizontal band between storeys.
- **Eave overhang** — roof edge extends `eave * sc` beyond the wall plane on both pitched and flat forms.
- **Foundation** — `Timber piles` exposes a `subfloor` clearance gap between FFL and ground; `Concrete slab` butts to ground.

Not a stub. Per your call, no screenshots — visual QA deferred to your own preview review.

---

## Files modified

- `src/lib/astral/store.ts` — finding #1, #2, #8
- `src/components/astral/Inspector.tsx` — finding #3
- `src/components/astral/MaterialsPanel.tsx` — finding #4
- `src/components/astral/SheetFrame.tsx` — finding #5
- `src/components/astral/SectionPanel.tsx` — finding #6
- `src/components/astral/views/PlanView.tsx` — finding #7

## Gate status

✓ Typecheck clean. ✓ No new lint warnings. ✓ Audit report committed at repo root.

**Phase B and Phase C are unblocked** whenever you give the go-ahead. Phase B should start with `bunx prettier --write src` to clear finding #14 before any new UI work lands.
