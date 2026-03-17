

## Plan: Cluster Only Clark County Markers

Currently all non-Tier-1 markers (hospitals + clinics) go into a single `markerClusterGroup`. Change this so only **Clark County** facilities get clustered; all other facilities render as individual markers.

### Changes in `src/components/map/MapView.tsx` (lines 212-251)

In the marker-drawing `useEffect`, split non-Tier-1 facilities into two paths:

1. **Clark County** hospitals/clinics → add to `clusterGroup` (existing clustering behavior)
2. **All other counties** hospitals/clinics → add directly to `markersRef.current` as individual markers (no clustering)

The condition is simply `facility.county === 'Clark'`. Everything else (Tier 1 handling, icons, tooltips, click handlers) stays the same.

