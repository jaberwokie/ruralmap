import L from 'leaflet';
import type { Feature, Geometry } from 'geojson';
import { nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import {
  getCountyUtilization,
  getUtilizationTier,
  UTILIZATION_COLORS,
} from '@/utils/utilizationAggregation';

interface RenderUtilizationChoroplethOptions {
  group: L.LayerGroup;
  pane: string;
  getCountyFeature: (countyName: string) => Feature<Geometry> | null;
  onCountyClick: (
    payload: { type: 'memberVolume'; county: string; memberCount: number },
    event: L.LeafletEvent,
  ) => void;
}

/**
 * Renders the Utilization Intensity choropleth (purple ramp) over Nevada
 * counties. Caller controls visibility by gating the effect (i.e. only
 * invoking this when the toggle is on); this helper unconditionally clears
 * the group then repopulates it.
 */
export function renderUtilizationChoropleth({
  group,
  pane,
  getCountyFeature,
  onCountyClick,
}: RenderUtilizationChoroplethOptions) {
  group.clearLayers();

  nevadaCounties.forEach((county) => {
    const util = getCountyUtilization(county.name);
    const tier = getUtilizationTier(util.avgVisitsPerMember);
    const colors = UTILIZATION_COLORS[tier];

    const clipped = getCountyFeature(county.name);
    if (!clipped) return;

    const geoLayer = L.geoJSON(clipped, {
      pane,
      style: {
        color: colors.border,
        weight: 1,
        fillColor: colors.fill,
        fillOpacity: 1,
      },
    });
    geoLayer.on('click', (e: L.LeafletEvent) => {
      const memberCount =
        memberVolumeData.find((entry) => entry.county === county.name)?.memberCount ??
        util.totalMembers;
      onCountyClick({ type: 'memberVolume', county: county.name, memberCount }, e);
    });
    group.addLayer(geoLayer);
  });
}
