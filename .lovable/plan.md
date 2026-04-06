
Problem:
- The hovered green pin in your screenshot is a rural service record (`Central Nevada Health District Eureka` in `src/data/rural-services.ts`), so service marker rendering and hover tooltip wiring are already working.
- The Details panel already supports `ruralService` via `RuralServiceContent` in `src/components/map/CoverageDetailPanel.tsx`.
- That means the remaining break is in the click pipeline for service markers: marker hit target and/or clustered marker click routing is still not reliably reaching persistent selection state.

Plan:
1. Normalize all marker clicks behind one selection helper in `src/components/map/MapView.tsx`
   - Create one internal path for all point markers: stop propagation, set click guard, prioritize marker, push the full entity record to `onEntityClick`.
   - Route green service pins and purple behavioral health pins through the exact same locked-selection path as red/blue provider pins.

2. Fix service marker hit-area without changing the visual design
   - Keep the current pin appearance.
   - Expand the clickable target for service and behavioral-health `divIcon` markers by wrapping the SVG in a fixed hit box or adding an invisible clickable SVG target.
   - This is the most likely reason hover works but click does not consistently lock selection.

3. Harden clustered service-marker behavior
   - Audit how `pointClusterRef` handles individual child markers after clustering/unclustering.
   - Ensure service markers remain clickable both before and after cluster expansion.
   - If needed, attach selection handling at the clustered child-marker level so the full service record always survives the cluster pipeline.

4. Tighten persistent selection state in `src/pages/Index.tsx`
   - Keep `lockedEntity` as the single source of truth for the Details panel.
   - Ensure any clicked service pin immediately replaces county or prior provider selection.
   - Add a dev-only guard during implementation so unsupported or malformed clicked entities fail loudly in code instead of silently leaving the panel empty.

5. Keep the service renderer data-driven and null-safe in `src/components/map/CoverageDetailPanel.tsx`
   - Confirm `ruralService` always renders `RuralServiceContent`.
   - Keep address, phone, website, directions, and action buttons conditional so missing optional fields never blank the whole panel.
   - Do not allow county fallback when a service entity is selected.

6. Verify end-to-end before closing
   - Test green service pins, purple behavioral-health pins, red hospital pins, and blue clinic pins.
   - Specifically verify `Central Nevada Health District Eureka` opens the right-side Details panel as a service record.
   - Confirm county view only appears when a county is actually selected.

Technical details:
- Primary fix file: `src/components/map/MapView.tsx`
- Likely supporting files: `src/components/map/pinVisuals.ts`, `src/index.css`, `src/pages/Index.tsx`, `src/components/map/CoverageDetailPanel.tsx`
- The current code already proves the schema exists (`entity.type === 'ruralService'`), so this should be treated as a service-marker interaction bug, not a panel layout bug.
