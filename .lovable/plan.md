
Goal: make the Provider toggle show the full mapped provider set that should be visible, without changing unrelated layers or behavior.

Plan

1. Audit the provider data path end-to-end
- Trace how providers move from `src/pages/Index.tsx` into `src/components/map/MapView.tsx`.
- Confirm which providers are being removed before rendering versus which never exist in the mappable facilities dataset.
- Compare the rendered provider source (`facilities` prop) against `allFacilities` and the utilization list to separate a rendering bug from a missing-data issue.

2. Apply the smallest safe rendering fix
- Stop letting the global `filteredFacilities` list unintentionally decide the provider map layer.
- In `MapView`, derive the provider marker input from the full mapped provider dataset (`allFacilities ?? facilities`) instead of the pre-trimmed list passed for sidebar/search results.
- Reapply only provider-relevant filters inside `MapView` for the provider layer itself:
  - search query
  - county filters
  - provider type chips like hospital/clinic
- Keep service/behavioral-health filtering from suppressing provider markers when those filters are meant for other layers.

3. Preserve existing provider behavior
- Keep the current red hospital / blue clinic custom pin icons exactly as-is.
- Keep the existing provider clustering and pane ordering so markers stay above county/utilization fills.
- Keep the current top-20 behavior intact, but make sure its filtered subset is built from the corrected provider source.

4. Validate against the failure described
- Provider toggle ON: all mapped provider facilities that match provider-specific filters render.
- Provider toggle OFF: provider markers fully clear.
- Service and Behavioral Health layers still behave exactly as before.
- Utilization shading, legend, county layers, hover/click behavior, and sidebar logic remain unchanged.

Important audit finding
- There are two different “provider universes” in the code right now:
  1. `src/data/facilities.ts` = mapped providers with coordinates
  2. `src/data/provider-utilization.ts` = broader utilization ranking list
- Many utilization providers do not appear to have facility map records/coordinates, so they cannot be shown on the map until they are added to `facilities.ts`.
- So the likely bug to fix now is accidental omission of already-mapped providers, not automatic mapping of every utilization-row provider.

Technical details
- Current likely root cause:
  - `Index.tsx` computes `filteredFacilities` using global filter chips and passes that trimmed array into `MapView` as `facilities`.
  - `MapView` currently renders provider markers from that already-filtered `facilities` prop.
  - This means provider points can disappear even when the Provider toggle is on, simply because another filter upstream removed them first.
- Minimal implementation target:
  - Update provider marker filtering in `MapView` so provider rendering uses the full mapped facility dataset and applies its own provider-specific filtering there.
  - Do not broadly refactor the sidebar, legend, county shading, or unrelated layer logic.

Acceptance criteria
- If a provider exists in the mapped facilities dataset and matches active provider-relevant filters, it appears when Provider is ON.
- If a provider exists only in utilization rankings but not in mapped facilities with coordinates, it will still remain absent until added as map data.
- No regression to other layers, toggles, or tutorial behavior.
