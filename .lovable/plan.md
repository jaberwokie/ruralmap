
## Fix plan: make Clark provider pins resolve to true addresses and stop visual displacement

### Root cause likely causing “still wrong in Clark”
- `Index.tsx` keeps facilities in component state initialized once from `defaultFacilities`.
- After data corrections in `facilities.ts`, active sessions can still show stale pre-fix coordinates/counties (the exact old Clark count pattern still appears).
- Provider clusters can spiderfy into radial layouts at deep zoom, which visually looks like pins are off-address even when source coordinates are correct.

### Implementation steps

1. **Make default facility data always live in-app (no stale seed state)**
   - In `src/pages/Index.tsx`, split data into:
     - `defaultFacilities` (always current from file)
     - `importedFacilities` (state for CSV additions only)
   - Derive `facilities = [...defaultFacilities, ...importedFacilities]`.
   - Update `handleAddFacilities` to append to `importedFacilities` only.

2. **Finalize Clark address precision in source + validation metadata**
   - In `src/data/facilities.ts`, verify and tighten any remaining Clark entries still marked as approximate (notably `t1, t4, t6, t9, t13`) to building-level coordinates.
   - In `src/utils/facilityValidation.ts`, update outdated overrides for `t1–t15` and `c6/c7` so source address/confidence reflects current corrected records (remove old “city-center fallback” notes where no longer true).

3. **Prevent cluster spiderfy from faking off-address placement**
   - In `src/components/map/MapView.tsx` provider cluster config (`markersRef`):
     - disable spiderfy at max zoom,
     - disable provider clustering at granular zoom (same threshold as overlap declutter, e.g. `OVERLAP_DECLUTTER_ZOOM`).
   - Keep low-zoom clustering behavior for cleanliness.

4. **Improve verification visibility**
   - Add street address line to provider tooltip in `MapView.tsx` so users can directly validate pin ↔ address alignment on-map.

### Technical details
- Primary files:
  - `src/pages/Index.tsx` (data source architecture)
  - `src/data/facilities.ts` (coordinates)
  - `src/utils/facilityValidation.ts` (confidence/source consistency)
  - `src/components/map/MapView.tsx` (cluster behavior + tooltip address)
- No changes to utilization ranking, Top 20 scoring logic, or county/access math.

### Acceptance checks
1. Clark no longer shows legacy clustered-at-one-point pattern from stale records.
2. Providers previously misassigned to Clark (Nye/Elko records) render in correct counties after normal app interaction (without requiring hard refresh workaround).
3. At deep zoom, provider markers no longer spiderfy into synthetic rings; they appear at true map locations.
4. Hover/click tooltip shows address and matches physical map location.
