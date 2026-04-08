
Goal: restore green and purple pin selection so a first click always locks the service into the detail panel.

What I found:
- The detail panel is already wired for non-provider services: `CoverageDetailPanel` handles `type: 'ruralService'`.
- Green and purple pins are still created in a different runtime path than providers.
- Providers are effectively on a hardened path:
  - created as `MapPointMarker`
  - stored in a cluster group used for working provider selection
  - explicit `marker.on('click', ...)`
  - extra native DOM fallback on `marker.once('add', ...)`
- Green/purple markers are still split:
  - created in their own loops
  - added to a separate cluster group (`pointClusterRef`)
  - no equivalent DOM fallback
  - legacy refs (`servicePresenceMarkerRef`, `behavioralHealthMarkerRef`) are still present but not actually used for the real clickable markers
- So the panel renderer is not the blocker now. The remaining break is the incomplete/non-unified marker interaction path for service and behavioral-health markers.

Implementation plan:
1. Replace the split green/purple marker setup with one shared point-marker helper
   - Build one helper that creates a `MapPointMarker`, assigns pane, entity, tooltip, hover priority, click binding, and fallback binding.
   - Use it for:
     - green service markers
     - purple behavioral-health markers
     - keep provider markers aligned with the same contract where practical

2. Put green and purple markers on the same authoritative selection contract as providers
   - Bind Leaflet click first with the same `selectMarkerEntity` flow providers use.
   - Add native DOM click only as fallback, not as the primary path.
   - Guard against duplicate selection calls when both Leaflet and fallback fire.

3. Remove the incomplete split state around service/BH marker groups
   - Stop keeping separate “marker refs” that are cleared but never receive the actual clickable markers.
   - Make the real rendered green/purple markers live in the authoritative marker collection used for click handling.
   - Keep any non-click decorative layers separate only if needed.

4. Normalize green/purple payloads exactly to the detail-panel contract
   - Ensure every green/purple marker always sets:
     - `__entity = { type: 'ruralService', service }`
     - stable `__entityId`
     - stable `__entityName`
   - Ensure the shared selection helper always passes that payload through unchanged.

5. Harden persistence and click guard behavior
   - Make green/purple clicks use the same marker guard and selected-marker priority logic as providers.
   - Prevent map background reset from clearing a marker click in the same interaction cycle.

6. Clean up layer ownership so the fix applies to all rendered green/purple pins
   - Apply the shared helper inside the full service and behavioral-health rendering loops, not to one subset.
   - Confirm every rendered green/purple marker gets the same pane, click binding, and fallback registration.

7. Validation after implementation
   - Click multiple green pins across different counties.
   - Click multiple purple pins across different counties.
   - Confirm first click opens `ruralService` detail content each time.
   - Confirm county selection is replaced by the clicked green/purple pin.
   - Confirm provider pins still work unchanged.
   - Confirm broadband/cellular overlays still display without stealing clicks.

Files to update:
- `src/components/map/MapView.tsx`
- only touch `src/index.css` if one small pointer-events correction is still needed after unifying the marker helper

Expected end state:
- Every green and purple pin uses the same reliable selection pipeline.
- Clicking any green or purple pin immediately populates the detail panel.
- Selection persists after click.
- Provider clicks, county clicks, and broadband/cellular overlays continue to work.
