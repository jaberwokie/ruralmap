import L from 'leaflet';
import type { Feature, Geometry } from 'geojson';
import { fteCapacityData, FTE_ROLE_COLORS } from '@/data/fte-capacity';

interface RenderFteFieldCoverageZonesOptions {
  group: L.LayerGroup;
  pane: string;
  activeFteCoverageIds: string[];
  getCountyFeature: (countyName: string) => Feature<Geometry> | null;
  createGeoJsonLayer: (
    feature: Feature<Geometry>,
    pane: string,
    style: L.PathOptions,
    interactive: boolean,
  ) => L.GeoJSON;
}

/**
 * Renders each active FTE's county responsibility footprint into the given
 * group. Field FTEs (Carson, Pahrump) use a dashed border + light tinted
 * fill. The Remote Coordination Team uses a dotted border + lower-opacity
 * fill so it reads as remote support rather than in-person field territory
 * and stays distinguishable when overlapped with field overlays.
 *
 * Caller controls visibility — this helper only adds layers; it does NOT
 * clear the group (it shares the highlights group with selected-county).
 */
export function renderFteFieldCoverageZones({
  group,
  pane,
  activeFteCoverageIds,
  getCountyFeature,
  createGeoJsonLayer,
}: RenderFteFieldCoverageZonesOptions) {
  activeFteCoverageIds.forEach((fteId) => {
    const fte = fteCapacityData.find((f) => f.id === fteId);
    if (!fte) return;
    const roleColor = FTE_ROLE_COLORS[fte.id]?.primary ?? 'hsl(0,0%,50%)';
    const isRemote = fte.hubLocation === null;

    fte.counties.forEach((countyName) => {
      const countyFeature = getCountyFeature(countyName);
      if (!countyFeature) return;

      const serviceAreaLayer = createGeoJsonLayer(
        countyFeature,
        pane,
        {
          color: roleColor,
          weight: isRemote ? 1.5 : 2,
          dashArray: isRemote ? '2 5' : '6 4',
          fillColor: roleColor,
          fillOpacity: isRemote ? 0.05 : 0.08,
        },
        false,
      );
      group.addLayer(serviceAreaLayer);
    });
  });
}
