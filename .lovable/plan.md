
Problem found: the Priority view is rendering, then getting wiped out immediately.

What is happening
- In `src/components/map/MapView.tsx`, both Engagement Gap views use the same shared layer group: `engagementGapRef`.
- The Priority effect correctly draws county fills when `engagementGapView === 'priority'`.
- But the Boundaries effect runs too, clears `engagementGapRef` first, then returns because the view is not `boundaries`.
- Result: Priority polygons are removed right after they are added, so visually it looks like nothing happened.

Evidence in code
- Priority effect clears and draws at `MapView.tsx:2257-2327`
- Boundaries effect also clears the same ref at `MapView.tsx:2330-2446`
- Both depend on `engagementGapView`, so switching views triggers both effects.

Implementation plan
1. Separate the two Engagement Gap render paths
- Create a dedicated layer group ref for Priority fills, separate from the existing Boundaries layer group.
- Keep boundary labels on their own ref as they are now, or split labels too if needed for cleaner cleanup.

2. Update map initialization
- Add the new priority layer group during Leaflet layer setup in `MapView.tsx`.
- Keep it on the same pane/z-order family so it stays:
  - above basemap
  - below markers, tribal boundaries, and selection highlights

3. Isolate cleanup logic
- Priority effect should only clear/redraw the Priority layer group.
- Boundaries effect should only clear/redraw the Boundaries layer group and its labels.
- No effect should clear the other view’s layer group.

4. Preserve current behavior
- Keep `engagementGapView` defaulting to `priority`
- Keep the inline toggle text as `Priority | Boundaries`
- Keep county click, hover, selected county outline, and detail panel behavior unchanged
- Keep marker and tribal layer visibility unchanged

5. Final verification
- Toggle Engagement Gap on: Priority should immediately produce visible county fills
- Switch to Boundaries: current boundary logic should still render exactly as before
- Switch back to Priority: fills should return instantly
- Confirm selected county outline remains above fills
- Confirm provider/service/behavioral markers and tribal boundaries remain above the priority layer

Files to update
- `src/components/map/MapView.tsx`

Technical note
The issue is not the color values or ranking math first. The main bug is a shared Leaflet layer group being cleared by the wrong effect. Fixing layer separation should make the current Priority styling actually appear.
