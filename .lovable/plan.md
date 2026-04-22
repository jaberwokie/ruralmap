
1. Verify what is actually deployed
- Compare the currently published `.lovable.app` domain and custom domain responses again after approval, including asset bundle references and any exposed build metadata.
- Add a non-admin, parse-safe build fingerprint so preview, published, and custom-domain builds can be compared directly without relying on hidden admin UI.
- Check whether the live domain is pointing at the latest published deployment or serving older cached assets.

2. Reconcile code vs observed behavior
- Inspect the current marker pipeline end to end for Services:
  - merged live/static services source
  - county filtering inputs
  - community-service split
  - clustering input
- Confirm whether “county-scoped Services markers” is actually implemented in the current codebase. Current read-only inspection shows `selectedCounty` triggers `fitBounds`, but Services filtering still depends on `countyFilters`, not `selectedCounty`.

3. Fix the real mismatch in app behavior
- If county-scoped Services is intended, apply the filter in the Services render path so county selection and Local Resource Network use the same scoped dataset.
- Keep Provider and Behavioral Health behavior unchanged unless explicitly required.
- Preserve clustering behavior so identical coordinates still produce one marker per service record and correct cluster counts.

4. Add deployment-visible diagnostics
- Surface a lightweight build/version marker in a public, low-noise place so anyone can confirm whether preview and live are on the same build.
- Optionally add a dev-only diagnostic log for Services marker counts by county to make future parity checks exact.

5. Republish and validate parity
- Publish the updated frontend build.
- Validate on:
  - preview
  - published `.lovable.app`
  - custom domain
- For Nye County, confirm all three match on:
  - Services marker input count
  - county scoping behavior
  - major cluster counts for shared-coordinate stacks
  - visible rendered result after county click

Technical details
- Relevant files already identified:
  - `src/components/map/MapView.tsx` — Services filtering, marker creation, clustering
  - `src/pages/Index.tsx` — county selection passed into `MapView`, merged services passed into detail panel
  - `src/hooks/useMapSelection.ts` — `selectedCounty` state
  - `src/hooks/useMapLayers.ts` — default layer state
  - `src/main.tsx` — current hidden build id injection
- Current read-only findings:
  - published visibility is already public
  - published and custom-domain HTML snapshots currently match each other
  - preview could not be compared directly because it is auth-gated in this mode
  - current repo does not show explicit `selectedCounty` filtering in the Services pin dataset
