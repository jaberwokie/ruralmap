
## Fix plan: remove the “giant blue pins” in Top 20 mode by fixing true marker isolation

### Root cause confirmed
- The blue “giant pins” are stacked provider markers, not a separate hub layer.
- In `MapView.tsx`, Top 20 uses non-clustered markers (`topProviderMarkersRef`), but `getDisplayCoordinates(...)` **does not declutter below zoom 11**.
- Your top-provider records contain many identical coordinates (especially Carson/Las Vegas in `src/data/facilities.ts`), so multiple clinic markers render directly on top of each other and look like one oversized pin.

### Implementation steps
1. **Add a dedicated Top 20 placement path in `src/components/map/MapView.tsx`**
   - Keep current ranking/filter pipeline unchanged.
   - Extend coordinate placement so that when `topProvidersOnly` is on, overlapping providers are spread in a deterministic radial layout **at all zoom levels** (not only zoom >= 11).

2. **Use pixel-space fan-out (map project/unproject) for Top 20**
   - Compute offsets in screen pixels (stable visual separation).
   - Convert back to lat/lng before marker creation.
   - Keep deterministic ordering (same provider order => same fan-out positions).

3. **Preserve normal behavior when Top 20 is off**
   - Existing clustering/declutter logic remains unchanged for standard mode.

4. **Harden exclusive rendering cleanup**
   - Ensure `topProvidersOnly` is included in relevant effect dependencies/guards so stale non-provider layers cannot persist when mode changes.

5. **Temporary validation logs**
   - Log:
     - filtered provider count before top-20 slicing,
     - final top20 length,
     - final top20 ids/names,
     - rendered marker count after fan-out.
   - This verifies we render true records, not visual aggregates.

### Technical details
- Primary file: `src/components/map/MapView.tsx`
- No changes to:
  - ranking metric/sorting logic,
  - sidebar structure/state behavior,
  - marker styling system,
  - unrelated filters/layers outside Top 20 isolation behavior.

### Acceptance checks
1. Turn on Top 20 at statewide zoom:
   - No giant stacked blue composite pins.
   - Top providers near identical coordinates are visibly separated.
2. Confirm debug output:
   - `top20.length === 20` (or fewer only when filtered dataset < 20).
3. Turn Top 20 off:
   - Normal map rendering/clustering behavior returns.
