---
name: presentation-mode
description: Passive demo overlay for stakeholder walkthroughs — phase-grouped, zone-positioned, session-only, fully removable
type: feature
---
Presentation Mode is a passive overlay used only for live stakeholder walkthroughs (NBH, SilverSummit). It does NOT modify map state, filters, selection, or any operational logic.

Constraints (must be preserved):
- Toggle pill mounted in the map canvas top-right (above zoom/recenter), not in the sidebar. Must read as a temporary viewing mode, not an admin or system control.
- 4 manual phases (1–4). Presenter selects via a small segmented control. No auto-advance, no next/previous, no progression UI.
- Max 4 callouts per phase. No two callouts in the same phase share a zone — guarantees no stacking.
- Zones are layout regions (sidebar / map quadrants / panel), not viewport pixels. CSS-only positioning. No DOM queries, no refs into MapView, no observers, no measurement.
- `pointer-events-none` wrapper on the overlay; only the toggle pill and phase chips capture clicks.

Lifecycle (must be preserved):
- State lives in React `useState` only. No localStorage, sessionStorage, cookies, or URL writes on toggle.
- Page refresh = mode resets to off, phase resets to 1.
- `?present=1` URL is a one-shot read on initial mount only; toggling does not update the URL.
- Cannot accidentally linger across sessions.

Removable: delete the toggle import in `MapView.tsx`, the overlay mount in `Index.tsx`, and the `presentation/` folder. No other coupling.

This is explicitly NOT a tutorial system. Do not add sequencing, progression, or map coupling.
