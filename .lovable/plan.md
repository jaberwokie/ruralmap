

## Problem

Currently, **all non-Tier-1 facilities in Clark County** go into the marker cluster group (line 246-247), while Tier 1 markers are placed on a separate unclustered layer. The user wants the opposite: only Tier 1 facilities in Clark County should be clustered; hospitals and clinics in Clark County should render as individual markers like everywhere else.

## Changes — `src/components/map/MapView.tsx`

In the marker placement logic (lines 244-250), change the routing:

**Current logic:**
- Tier 1 → `tier1Ref` (unclustered)
- Clark County (non-Tier-1) → `clusterGroup` (clustered)
- Everything else → `markersRef` (unclustered)

**New logic:**
- Tier 1 in Clark County → `clusterGroup` (clustered)
- Everything else (including hospitals/clinics in Clark, and Tier 1 outside Clark) → `markersRef` (unclustered)

This removes the `tier1Ref` special-casing and instead uses the cluster group exclusively for Tier 1 markers in Clark County.

