
1. Refactor selection state in `src/pages/Index.tsx` into a single panel-driving source of truth:
   - replace the implicit `lockedEntity`/`hoverEntity` fallback behavior with explicit persistent selection for the right-side panel
   - keep hover preview separate so hover can never override a clicked provider
   - derive county highlight/FTE focus only from county-like selected entities, not provider selections

2. Tighten marker-to-panel routing in `src/components/map/MapView.tsx`:
   - audit all clickable marker layers and make them all call the same provider-selection path with the full underlying record
   - preserve county clicks for county entities, but ensure provider/service/facility clicks always replace county panel content immediately
   - keep click propagation stopped on markers so the map background click does not clear selection in the same interaction
   - ensure clustered service markers and facility markers both resolve to exact record-level entities after expansion

3. Rebuild `CoverageDetailPanel` as one shared panel shell with two renderer modes:
   - `CountyDetailsRenderer`
   - `ProviderDetailsRenderer`
   - panel mode should be determined strictly by selected entity type, never by hover/default content
   - remove county fallback content from provider mode entirely

4. Convert county details from flat cards into true accordions:
   - create one reusable accordion section component for both county and provider views
   - only one section open at a time
   - first visible county section expanded by default
   - move existing county cards like Member Volume, Engagement Priority, Coverage Breakdown, Regional FTE Support, Utilization/Operational sections into collapsible bodies
   - omit empty sections completely

5. Normalize provider/service detail rendering into true accordions:
   - keep Provider Information expanded by default
   - add/retain Services Offered, Contact Information, Access Details, and Engagement Metrics only when data exists
   - make service records and facility records share the same section system so behavior is consistent across all pin types

6. Fix provider website + action utilities in the provider renderer:
   - validate `website` before rendering
   - show `Visit Website` inside Contact Information when valid
   - add compact top action row under the title with data-driven `Call`, `Directions`, and `Website` buttons
   - use full address for directions when present, fallback to lat/lng otherwise
   - render nothing for missing fields/buttons

7. Clean up panel precedence rules:
   - clicked provider/service/facility always wins over county selection until cleared
   - closing the panel clears only panel selection state
   - hover remains non-persistent and must never populate the persistent panel when a selection exists

8. Verify against the current known failure points:
   - hospital, clinic, service, and behavioral health pins all open exact provider details
   - county content no longer appears after provider click
   - county and provider details both use real expanding/collapsing accordion bodies
   - website/action buttons appear only when backed by real data
   - no empty rows, dead buttons, or stale county metrics in provider mode

Technical notes:
- Root cause is visible now: `CoverageDetailPanel` currently uses `const display = entity ?? hoverEntity`, so the panel is mixing persistent selection with hover fallback.
- County content is still rendered as static stacked sections in `CountyContent`, while only facility/service branches use `DetailSection`.
- Website/action UI exists in `FacilityContent` and `RuralServiceContent`, but most dataset records currently do not include `website`, so rendering must stay optional and null-safe.
- Marker click wiring already exists for county, facility, and rural service markers in `MapView.tsx`; this pass should standardize panel state precedence rather than redesign the map.
