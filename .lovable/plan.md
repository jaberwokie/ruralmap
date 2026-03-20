
Goal

Make the current “Service Network” layer create an obvious visual change while keeping it truthful. Based on the audit, the right outcome is B: rename it to match what it actually shows.

What the audit found

- The current layer is not a true network.
- It renders point markers only, not lines or polygons.
- Those points come from `src/data/rural-services.ts`, which is a county/city/category service directory dataset.
- The dataset has no relationship fields, no edges, no referral links, and no coordination structure to support real network lines.
- The layer is rendered in the same marker pane as Provider Locations (`MAP_PANES.facilityMarkers`), so it competes visually with facility pins.
- Current styling is subtle: small blue circle markers (`radius: 4.5`) that visually read like another set of provider dots.
- Result: the toggle is technically working, but the change is easy to miss and semantically overlaps with Provider Locations.

Recommended implementation

1. Rename the layer everywhere from “Service Network” to “Service Presence”
- Update sidebar label
- Update tooltip/help copy
- Update tutorial step copy that references this layer
- Update any diagnostic labels so naming stays consistent

2. Replace duplicate-looking service points with a distinct distribution visualization
- Stop rendering rural services as individual point markers in the same visual language as provider locations
- Instead render county-level service presence halos or clustered county service presence markers derived from real `ruralServices` counts
- Use county-centered or service-cluster-centered visuals sized by real service count, with soft fill and thin outline
- Keep them visually separate from provider pins: lighter, larger-area presence cues rather than dot markers

3. Keep truthfulness
- Do not introduce connecting lines or arcs, because the data does not support relationships
- Keep county detail panel behavior tied to real rural services data so clicking/hovering still opens the existing county resource context
- If needed, use grouped county entities (`ruralServiceGroup`) rather than individual service pins

4. Make the toggle obviously visible but clean
- Put the presence layer above county/base overlays and below hover UI/highlights
- Use a dedicated pane or clearly different styling so it does not disappear under other layers
- Tune radius/opacity/stroke for normal zoom readability without clutter in Carson/Douglas/Washoe

5. Preserve performance and current map behavior
- Precompute grouped service presence by county
- Reuse existing `filteredRuralServices` / county filter logic
- Avoid per-service heavy geometry work
- Do not touch unrelated layers, county hover metrics, or debug exposure

Likely file changes

- `src/components/map/MapView.tsx`
  - Replace per-service circle markers with county/service-presence visualization
  - Keep hover/click wiring to existing county service detail behavior
  - Optionally move this layer to its own pane for visibility
- `src/components/map/Sidebar.tsx`
  - Rename toggle label to “Service Presence”
- `src/data/help-tooltips.ts`
  - Rename/update help text to describe presence/distribution, not network relationships
- `src/pages/Index.tsx`
  - Update toggle diagnostics naming
- `src/data/map-tutorial.ts`
  - Update walkthrough wording if it still says “Service Network”

Technical design

```text
Current:
ruralServices -> many small point markers -> same pane/look family as provider locations

Planned:
ruralServices -> group by county / visible service clusters -> distinct presence halos
             -> click/hover county resource group -> existing detail panel
```

Visualization choice

- Chosen approach: service presence distribution layer
- Not chosen: network lines/arcs, because that would invent relationships not present in the data

Acceptance criteria this plan targets

- Toggling the layer creates an obvious visible change
- The layer no longer looks like duplicate provider locations
- The name matches the real data
- Dense counties remain readable
- No fake network relationships are introduced

Implementation report I will provide after approval

- What the current layer was actually showing
- Whether it duplicated provider points visually
- What replacement visualization was implemented
- Whether the layer name was changed to “Service Presence”
