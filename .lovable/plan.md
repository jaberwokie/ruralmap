
Goal: Make Coverage Radius clearly visible across all map states (zones on/off, member-volume on/off, and coverage gaps on).

Plan

1) Strengthen radius visual styling in `src/components/map/MapView.tsx`
- Update `AREA_RADIUS_COLORS` opacity values to much higher contrast (not subtle tints).
- In the radius circle options, increase stroke thickness and dash visibility:
  - `weight` from thin to bold.
  - longer dash pattern for clearer ring identity.
- Keep a moderate fill so circles read as areas without obscuring map details.

2) Add a high-contrast “halo” ring per radius
- For each hospital radius, render two circles:
  - Base halo circle (very light/neutral, solid, slightly wider stroke) for separation from choropleth colors.
  - Main colored dashed ring on top.
- This creates edge contrast even when underlying layers are busy.

3) Improve layer priority for visibility
- Ensure `radiusRef` is above `gapsRef` in map layer creation order so gap tint does not wash out radius rings.
- Keep markers above radius so points remain clickable and visually primary.

4) Keep interaction clean
- Set radius circles to non-interactive (`interactive: false`) so they don’t block marker hover/click behavior.

5) Validation checklist after implementation
- With Member Volume ON, confirm rings are still clearly readable.
- With Coverage Gaps ON, confirm rings are not muted by the red gap overlay.
- At multiple `radiusKm` values, confirm rings remain legible at current zoom.
- Confirm marker tooltip/click behavior is unaffected.

Technical details
- File: `src/components/map/MapView.tsx`
- Sections to update:
  - `AREA_RADIUS_COLORS` constant
  - Coverage-radius `useEffect` circle creation block
  - Layer-group initialization order in map setup effect
- No API/data-model changes required; this is a rendering-only update.
