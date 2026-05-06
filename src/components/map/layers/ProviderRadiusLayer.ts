import L from 'leaflet';
import { getProviderAccessTierByKm } from '@/utils/providerAccessTiers';

interface ProviderRadiusFacility {
  lat: number;
  lng: number;
  type: string;
}

interface RenderProviderRadiiOptions {
  group: L.LayerGroup;
  pane: string;
  providers: Array<{ lat: number; lng: number; kind: string; facilityType: string }>;
  radiusKm: number;
  /** When true, fill becomes white to support the Access Gaps composite visual. */
  isGap: boolean;
}

/**
 * Renders the provider coverage radius rings (white halo + colored circle per
 * provider) at the given radius. Caller controls visibility by gating the
 * call (e.g. early-return when `coverageRadius` is off or providers list is
 * empty); this helper unconditionally clears then repopulates the group.
 */
export function renderProviderRadii({
  group,
  pane,
  providers,
  radiusKm,
  isGap,
}: RenderProviderRadiiOptions) {
  group.clearLayers();
  if (providers.length === 0) return;

  const visibleFacilities: ProviderRadiusFacility[] = providers.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    type: p.facilityType,
  }));

  const accessTier = getProviderAccessTierByKm(radiusKm);

  visibleFacilities.forEach((facility) => {
    const colors = accessTier === 'strong'
      ? facility.type === 'hospital'
        ? { stroke: 'hsla(0, 72%, 51%, 0.55)', fill: 'hsla(0, 72%, 51%, 0.10)', dashArray: undefined, haloOpacity: 0.7 }
        : { stroke: 'hsla(217, 91%, 60%, 0.38)', fill: 'hsla(217, 91%, 60%, 0.08)', dashArray: undefined, haloOpacity: 0.7 }
      : accessTier === 'conditional'
        ? facility.type === 'hospital'
          ? { stroke: 'hsla(0, 72%, 51%, 0.42)', fill: 'hsla(0, 72%, 51%, 0.08)', dashArray: undefined, haloOpacity: 0.52 }
          : { stroke: 'hsla(217, 91%, 60%, 0.3)', fill: 'hsla(217, 91%, 60%, 0.06)', dashArray: undefined, haloOpacity: 0.52 }
        : accessTier === 'weak'
          ? facility.type === 'hospital'
            ? { stroke: 'hsla(0, 72%, 51%, 0.28)', fill: 'hsla(0, 72%, 51%, 0.05)', dashArray: '8 8', haloOpacity: 0.38 }
            : { stroke: 'hsla(217, 91%, 60%, 0.22)', fill: 'hsla(217, 91%, 60%, 0.045)', dashArray: '8 8', haloOpacity: 0.38 }
          : facility.type === 'hospital'
            ? { stroke: 'hsla(0, 20%, 45%, 0.2)', fill: 'hsla(0, 12%, 50%, 0.035)', dashArray: '4 10', haloOpacity: 0.26 }
            : { stroke: 'hsla(217, 18%, 52%, 0.18)', fill: 'hsla(217, 18%, 52%, 0.03)', dashArray: '4 10', haloOpacity: 0.26 };

    // Single source of truth for the white-centered gap visual.
    // Driven directly by the same `coverageGaps` flag that controls the
    // Access Gaps overlay — no parallel condition can drift.
    const fillColor = isGap ? '#ffffff' : colors.fill;
    // Force full opacity in gap mode so no prior blue tint can show
    // through. Non-gap circles keep `fillOpacity: 1` (the colored fill
    // already encodes its own alpha in HSLA), preserving prior styling.
    const fillOpacity = 1;

    const halo = L.circle([facility.lat, facility.lng], {
      pane,
      radius: radiusKm * 1000,
      color: `hsla(0, 0%, 100%, ${colors.haloOpacity})`,
      weight: 4,
      fillColor: 'transparent',
      fillOpacity: 0,
      interactive: false,
    });
    group.addLayer(halo);

    const circle = L.circle([facility.lat, facility.lng], {
      pane,
      radius: radiusKm * 1000,
      color: colors.stroke, // stroke / ring color preserved in both modes
      weight: 2.5,
      fillColor,
      fillOpacity,
      dashArray: colors.dashArray,
      interactive: false,
      // Tag the SVG path so we can verify the gap state in DOM/tests.
      className: isGap ? 'coverage-radius coverage-radius--gap' : 'coverage-radius',
    });
    group.addLayer(circle);
  });
}
