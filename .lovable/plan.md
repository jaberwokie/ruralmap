

## NBH + SilverSummit Walkthrough — Final Refinement

Two refinements applied. Structure and deliverables unchanged.

---

### 1. Presentation Mode Lifecycle (new constraint)

- State lives only in React `useState` inside `usePresentationMode.ts`.
- No `localStorage`, no `sessionStorage`, no cookies, no URL rewrite on toggle.
- Page refresh = mode resets to off, phase resets to 1.
- `?present=1` URL convenience retained as a one-shot read on mount only; toggling does not update the URL, and reload without the param starts clean.
- Closing/reopening the tab = clean state. No carryover between sessions.
- Result: presenter cannot accidentally leave the app in Presentation Mode for a real user.

### 2. Callout Title Refinements

Sharper, more grounded phrasing for the live walkthrough. Bodies unchanged.

| Phase | Old title | New title |
|---|---|---|
| 1 | What Exists vs What's Usable | **Listed Resources ≠ Usable Options** |
| 4 | Supports Decisions, Not Automation | **This Informs Decisions, It Doesn't Make Them** |

Other 8 titles unchanged:
- Operational Map, Not a Directory
- Geography Drives Constraints
- Member-Level Reality
- Distance ≠ Access
- CHW Ownership Model
- Verified vs Assumed Access
- Connectivity Defines Feasibility
- Known Limits

PDF section headers and Q&A wording stay aligned to the same phrasing where these titles appear.

---

### Everything else (unchanged from prior approval)

**Overlay**
- Toggle pill in map top-right control stack (above zoom/recenter), not in sidebar.
- Layout-aware zone positioning (sidebar / map quadrants / panel) via CSS only — no DOM queries, no observers, no refs.
- 4 phases, manual selector (`1 · 2 · 3 · 4`), max 4 callouts visible, no zone collisions, no auto-advance.
- `pointer-events-none` wrapper; only toggle and phase chips capture clicks.
- Fully removable: delete the toggle from `MapView.tsx` and the overlay mount from `Index.tsx`.

**PDF**
- 10-section walkthrough + 4 comparison pairs (member presence, verification trust, CHW ownership, county access contrast).
- 47 Q&A across 10 categories (including Failure Modes / Misinterpretation Risk).
- Generated via Python + ReportLab → `/mnt/documents/rural-map-walkthrough.pdf`, with mandatory per-page visual QA (`pdftoppm -jpeg -r 150`) before delivery.

**Files**
- New: `src/hooks/usePresentationMode.ts`, `src/components/map/presentation/PresentationToggle.tsx`, `src/components/map/presentation/PresentationOverlay.tsx`, `src/components/map/presentation/presentationCallouts.ts`
- Edited: `src/pages/Index.tsx` (mount overlay), `src/components/map/MapView.tsx` (mount toggle)
- Sidebar footer: no change

**Memory**
- New: `mem://features/presentation-mode.md` — passive, phase-grouped, zone-positioned, max 4 callouts, **session-only state (no persistence)**, removable
- Update: `mem://tech/tutorial-system-removal` — note Presentation Mode is explicitly NOT a tutorial

### Out of scope
- No persistence of any kind
- No DOM measurement, observers, or refs into MapView
- No auto-advance, next/previous, or progress UI
- No changes to filters, selection, panels, or any map logic
- No new global CSS

