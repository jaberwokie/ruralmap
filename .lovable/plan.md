
Fix the actual remaining failure instead of repeating the earlier wrong assumption.

What I found:
- The detail panel path is already wired for `facility` and `ruralService` entities.
- `Index.tsx` is using `lockedEntity` directly, so county fallback is not the main blocker now.
- `MapView.tsx` already adds green and purple pins to dedicated layer groups and already attaches `marker.on('click')`.
- The likely remaining break is the marker DOM hit area, not the panel renderer:
  - `getSharedPinSvgMarkup()` creates a 28×28 wrapper, but the visible/clickable SVG inside it is still only 14×14.
  - The pin graphic is stroke-only with `fill="transparent"`, so a lot of the apparent target can still miss.
  - That fits your symptom exactly: hover tooltip may appear, but single-click on a green pin like Carlin still does not reliably lock selection and populate Details.

Plan:
1. Make the entire 28×28 marker wrapper truly clickable
   - Update `src/components/map/pinVisuals.ts`
   - Keep the visual design the same.
   - Add an invisible full-hitbox element or explicit pointer-event behavior so the whole wrapper receives clicks, not just the tiny SVG stroke.

2. Normalize point selection into one helper in `src/components/map/MapView.tsx`
   - Create one internal selection function for all point markers:
     - stop propagation
     - set click guard
     - apply selected priority
     - send `marker.__entity`
   - Use it for:
     - green service pins
     - purple behavioral health pins
     - red/blue provider pins
     - cluster-group click fallbacks

3. Remove duplicated direct entity payload creation inside click handlers
   - Use `marker.__entity` as the single source of truth for clicked marker data.
   - This avoids any mismatch between rendered marker type and panel entity type.

4. Preserve panel logic, but harden it against silent failure
   - Keep `CoverageDetailPanel.tsx` branching by `entity.type`.
   - If a valid `ruralService` arrives, it must always render `RuralServiceContent`.
   - Do not allow empty-panel behavior from optional missing fields.

5. Clean up the panel console warning at the same time
   - Fix the `Function components cannot be given refs` warning in `CoverageDetailPanel.tsx`.
   - This is separate from the map click bug, but it should be removed because it can affect panel interaction reliability and accordion behavior.

6. Verify the exact failing case after the hit-area fix
   - Re-test the Carlin green pin specifically.
   - Then re-test:
     - green service pins
     - purple behavioral-health pins
     - red hospital pins
     - blue clinic pins
   - Confirm each single click updates the right-side Details panel immediately with the correct entity.

Files to update:
- `src/components/map/pinVisuals.ts`
- `src/components/map/MapView.tsx`
- `src/components/map/CoverageDetailPanel.tsx`

Expected end state:
- Clicking the green Carlin pin opens `RuralServiceContent` in the Details panel.
- All visible pin types use one consistent click-to-selection path.
- No stale county content overrides a clicked pin.
- Accordion sections still work.
- The current ref warning is gone.
