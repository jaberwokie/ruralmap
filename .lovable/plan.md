
Fix scope:
- Do a hard audit of the green service and purple behavioral health marker pipeline in `src/components/map/MapView.tsx`.
- Keep county logic, filters, hover behavior, and overall layout unchanged.
- Fix only marker-to-panel routing so every visible point pin opens the shared right-side Details panel with the exact clicked record.

What the code shows now:
- Facility pins already call `onEntityClickRef.current?.({ type: 'facility', facility })`.
- Green and purple pins also appear to call `onEntityClickRef.current?.({ type: 'ruralService', service })`.
- But the service/BH layers are split across multiple layer groups (`servicePresenceMarkerRef`, `behavioralHealthMarkerRef`, `pointClusterRef`), and the dedicated service/BH marker groups are being cleared but not populated in the visible marker pass.
- That mismatch strongly suggests the visible hoverable points are not reliably the same layer instance that is wired to persistent selection.

Implementation plan:
1. Refactor service/BH point rendering in `MapView.tsx` so there is one shared helper for clickable non-facility pins:
   - build marker
   - bind hover tooltip
   - bind `mouseover` / `mouseout`
   - bind click with `L.DomEvent.stopPropagation`
   - route to one shared select function that always passes the full `RuralService` record

2. Remove the split-brain behavior between visible service/BH marker layers and clustered marker layers:
   - ensure the exact visible green/purple marker instances are the ones added to the active map layer
   - do not leave service/BH clickability dependent on an unpopulated or hidden layer group
   - keep clustering behavior intact after zoom/expand

3. Standardize selection dispatch:
   - service and BH clicks both call the same persistent panel-selection path
   - selected entity must always be `{ type: 'ruralService', service }`
   - no county fallback, group fallback, or hover fallback on click

4. Verify parent state wiring in `src/pages/Index.tsx` remains strict:
   - clicked service/BH marker replaces any county selection immediately
   - panel close clears only panel selection
   - hover remains non-persistent

5. Keep `CoverageDetailPanel.tsx` as the single renderer target:
   - `ruralService` continues to render provider/service detail mode
   - no county summary content can appear after a service/BH click
   - existing action buttons and website rows remain data-driven and null-safe

Acceptance checks after implementation:
- Every visible green service pin opens the right-side Details panel on single click.
- Every visible purple behavioral health pin opens the right-side Details panel on single click.
- Expanded cluster children also open the panel correctly.
- Hover tooltip can still appear, but click now creates persistent Details panel selection.
- Clicking a green/purple pin never leaves county content in the panel.

Technical note:
- The likely bug is not the panel renderer anymore; it is the service/BH marker layer architecture in `MapView.tsx`.
- The next pass should fix the actual rendered marker instances and their click routing, not rework panel styling again.
