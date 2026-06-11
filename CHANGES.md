# Phase B — Calm first-open · user-facing changes

## Top bar consolidation
- Old layout had three stacked bars: brand row + ProjectsBar + ExportBar. They now collapse to a single header: **brand · mode toggle · project chip (centre) · quick save · ⋯ menu**.
- The ⋯ menu groups everything that used to live in two visible toolbars: **Projects (open / save / share)**, **Export PNG / PDF / CSV**, **Materials & schedules**, **Vision (sketch & renders)**, sign in / sign out.
- Quick-save (💾) saves the current project in one tap. If you are not signed in, it opens the Projects sheet so you can sign in.
- Project chip in the centre shows the current project name and `saved` / `unsaved` status; tap it to open the Projects sheet.

## Hidden-by-default panels
- **Materials**, **Vision**, **Export**, and **Projects** no longer take up screen real estate on first open. Each opens as a right-side overlay sheet from the ⋯ menu and can be dismissed with ✕ or `Escape`.
- The Inspector still appears only when something is selected (unchanged).
- The Section panel stays in its column for now; pinning + slim left-rail re-layout was scoped out to a follow-up pass.

## Mobile sticky mode footer
- On widths ≤ 720px the **Dream / Build** toggle moves from the header to a sticky bottom footer with full-width 48 px tap targets, leaving the header for brand + actions.
- All overlay sheets become full-width on mobile.
- Bottom padding is reserved so workspace content is never trapped under the footer.

## Calmer Resolve cards
- Each Resolve card (studs, lintels, bracing, foundation, etc.) now opens with just the **headline statement + in-scope / SED badge**. The technical evidence (3604 table refs, member sizes, BU counts) is collapsed behind a `show technical details` link on each card.

## Welcome card
- Replaced the three generic options with Build-relevant entry paths:
  1. **Start from a template** — loads the default 10 × 8 garage and drops you straight into Build.
  2. **Upload existing plans** — opens the Vision sheet so you can drop a PDF / image (full plan-ingestion pipeline lands in Phase C).
  3. **Sketch a quick idea** — opens the same Vision sheet for napkin-sketch transcription.
- Dream mode is reachable any time from the header mode toggle (or mobile footer), so it is no longer pushed from the welcome modal.

## Notes
- Phase A formatting backlog cleared: ran `prettier --write src` (audit finding #14).
- No behaviour changes to Build mode features themselves — Inspector, Resolve rules, agent, export, vision flows all unchanged. Only their **first-open visibility** is different.
- Dream mode untouched, per the strategic reframe.

# Phase C — Plan ingestion & elaboration · user-facing changes

## C1–C3 (recap)
- New **Source plans** tab inside the Vision sheet (⋯ menu → Vision).
- Upload PDFs or images of an existing project. PDFs are rendered client-side to page thumbnails; uploads go to a private `source-plans` bucket scoped to your user.
- **Analyse** runs a vision LLM (Gemini 3 Flash) over every page, classifies it (floor plan / elevation / section / detail / schedule / cover), and proposes patches in the existing Build-mode action grammar — `setFootprint`, `addOpening`, `setRoof`, etc.
- Per-page **diff card** with confidence score (below 60% is yellow-flagged for manual review). Patches are checkboxes — pick what to apply, hit **Apply N to model**; everything routes through the existing store so it lands in the timeline and can be rewound.

## C4 — Elaboration shortcuts
- New toolbar inside the Source plans panel: **All elevations · Sections · Details · Framing plan · Foundation plan · Full elaborated PDF set**.
- The jump-buttons switch the canvas to the corresponding Build view so you can see every drawing Astral can elaborate from the extracted model — even ones the source set didn't include.
- **Full elaborated PDF set** triggers the standard A0–A5 export with the new elaborated watermark applied to every page.

## C5 — Side-by-side comparison
- Source page thumbnails stay visible in the Source plans panel after analysis.
- Each analysis diff card has a **↔ Compare on canvas** button that maps the page's kind (and compass face, for elevations) onto the equivalent Astral view and updates the canvas — so the source thumbnail and Astral's rendering of the same view are visible at once.
- Source PDFs / images can also be re-opened via **Preview** (signed URL, 15-minute TTL).

## C6 — Honesty & safety
- Once any patch is applied from an uploaded source plan, the project is flagged `sourceElaborated`. From that point on:
  - The title-block sub-line on every sheet switches from `concept / indicative — not for construction` to `elaborated from source plan — review against original`.
  - The PDF watermark switches from `CONCEPT — INDICATIVE, NOT FOR CONSTRUCTION` to `ELABORATED FROM SOURCE PLAN — REVIEW AGAINST ORIGINAL — NOT FOR CONSTRUCTION`.
  - The cover-sheet disclaimer is replaced with the elaborated-from-source variant that explicitly tells the reader to check Astral's drawings against the original author's documents.
- Source plans live in a **private** bucket with RLS — only the project owner can read them; they are never re-exported.
- Copyright reminder is shown in-panel: "Source plans are the original author's IP. Astral analyses them for your working use only."
- Below 60% confidence the diff card is yellow-flagged and tagged "⚠ low confidence — review manually".
