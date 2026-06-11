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
