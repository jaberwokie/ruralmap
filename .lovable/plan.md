
Do I know what the issue is? Yes.

Actual issue:
- The green Carlin pin is a real rural service record (`rs-80`, `Carlin Community Health Center`), and its hover tooltip proves the record is rendering.
- The remaining break is in `src/components/map/MapView.tsx`: service and behavioral-health markers are created with click handlers, but they are only pushed into the shared `pointClusterRef` path. The dedicated `servicePresenceMarkerRef` / `behavioralHealthMarkerRef` layers are created and cleared but never populated.
- That means green/purple pins still depend entirely on `Leaflet.markercluster` click routing even when shown as individual pins, which is why hover can work while the Details panel still fails to update.

Files to fix:
- `src/components/map/MapView.tsx`
- `src/pages/Index.tsx`
- `src/components/map/CoverageDetailPanel.tsx`
- `src/components/map/pinVisuals.ts` only if hit-area tuning is still needed after the main fix

Implementation plan:
1. Fix the render path for service and behavioral-health pins in `MapView.tsx`
   - Stop treating all service/BH pins as cluster-only.
   - Render them through their dedicated marker layers when they are shown as individual pins.
   - Keep clustering only for the zoom states where clustering is actually needed.

2. Create one shared entity-selection helper in `MapView.tsx`
   - One function for all point clicks: stop propagation, set click guard, apply selected z-index priority, and send the full `MapEntity`.
   - Use it for:
     - provider markers
     - service markers
     - behavioral-health markers
     - cluster child-marker clicks

3. Make service/BH click routing independent of cluster quirks
   - Keep the cluster-group listener as a fallback for clustered states.
   - Ensure non-clustered green/purple pins fire their own direct marker click path every time.
   - Remove duplicated partial paths that can diverge.

4. Tighten persistent selection state in `Index.tsx`
   - Keep `lockedEntity` as the only persistent source for the Details panel.
   - Ensure a clicked `ruralService` always replaces county/provider content immediately.
   - Add a dev-only guard so malformed clicked entities are visible in code instead of silently showing the empty default panel.

5. Harden `CoverageDetailPanel.tsx`
   - Keep strict branching by `entity.type`.
   - Ensure `ruralService` always renders `RuralServiceContent`.
   - Prevent silent fallback to county/default content when a service entity exists.
   - Keep null-safe rendering for missing optional fields, but do not let missing website/phone/address blank the whole panel.

6. Verify the exact failing case and all pin types
   - Confirm `Carlin Community Health Center` opens the shared right-side Details panel on single click.
   - Re-test:
     - red hospital
     - blue clinic
     - green service
     - purple behavioral health
   - Confirm county content only appears when a county was actually selected.

Technical notes:
- Main bug is not the panel schema; `ruralService` is already supported.
- Main bug is not hover; hover already proves service records render.
- Main bug is the click-to-selection transport for service/BH pins.
- The existing unused refs (`servicePresenceMarkerRef`, `behavioralHealthMarkerRef`) strongly suggest the map was meant to support direct non-clustered service/BH markers but currently does not.

Acceptance criteria:
- Clicking the green Carlin pin opens service details in the right panel.
- Every visible green service pin opens service details reliably.
- Purple behavioral-health pins also open correctly.
- Provider pins still work.
- County details never override a clicked service/provider pin.
- No empty panel on valid pin click.
