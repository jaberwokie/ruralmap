

## Revised Plan: Port Map Features to LANTERN (Clark County Urban Focus)

### Key Context Shift
LANTERN serves **non-rural Clark County only** — Las Vegas, Henderson, North Las Vegas, Downtown, Historic Westside, Spring Valley, The Strip, East Las Vegas. This is a dense urban environment, not rural Nevada. The PWA is used primarily on **mobile devices outdoors** by people experiencing homelessness.

This changes priorities significantly from the earlier plan.

### What to Port (Revised)

#### 1. Marker Clustering (highest priority)
Clark County is where pin density is worst — dozens of shelters, meal sites, and hygiene stations overlap in downtown Las Vegas alone. Add `supercluster` to replace the current per-marker DOM loop in `MapLibreMapView.tsx` with a GeoJSON source + cluster layers. Cluster circles show counts, expand on tap/zoom.

**File:** `src/components/MapLibreMapView.tsx` — replace the `mappable.forEach` marker loop with a clustered GeoJSON source.

#### 2. "Near Me" Geolocation Button
Urban outdoor users need "what's closest to me right now." Add a GPS locate button (44×44px minimum tap target) that centers the map on the user's position and sorts resources by walking distance. Use the browser Geolocation API with a fallback message if denied.

**File:** `src/components/MapLibreMapView.tsx` — add a locate control button and geolocation handler.

#### 3. Sunlight-Readable Defaults
The current dark basemap is hard to read in direct Las Vegas sun. Change the default map style to `light` (Voyager) for outdoor readability while keeping the dark/light toggle. Increase marker size from 28px to 32px for better visibility.

**File:** `src/components/MapLibreMapView.tsx` — change `osDefault` fallback to `"light"`, bump `MARKER_SIZE` to 32.

#### 4. Map Legend Overlay
LANTERN already has `IconLegendModal.tsx` but it's a separate modal. Add a small collapsible on-map legend in the bottom-left corner showing category colors, using the existing `getCategoryHsl` function.

**File:** New `src/components/MapLegend.tsx`, referenced from `MapLibreMapView.tsx`.

### What NOT to Port (Revised)
- **County boundaries, FTE capacity, coverage radius, gap analysis** — operational planning tools irrelevant to end users
- **Drive-time zones** — not useful in an urban grid with transit
- **Building-level geocoding audit** — LANTERN pulls from Supabase dynamically; coordinate quality should be enforced at data entry in `ResourceFormDialog.tsx`, not via a bulk audit of static data
- **Fit-to-bounds on filter** — in a single-metro context, the map viewport rarely needs to jump; "Near Me" is more useful
- **Offline tile caching** — Clark County urban areas have reliable cell coverage; not a priority

### Implementation Order
1. Clustering (fixes the Las Vegas pin pile-up)
2. Geolocation button (highest-value mobile feature)
3. Sunlight defaults (two-line change, immediate readability win)
4. Map legend (quick add)

### Technical Notes
- All changes happen in the [LANTERN](/projects/33ace3b4-b9db-496b-b41d-f040d4cd545f) project
- `supercluster` is the standard clustering library for MapLibre GL
- Geolocation uses the browser API, no external service needed
- Current map is 296 lines; clustering will roughly double it
- 44×44px tap targets are already used for markers; same standard applies to the locate button and legend toggle

