import L from 'leaflet';
import type { Feature, Geometry } from 'geojson';

interface RenderSelectedCountyHighlightOptions {
  group: L.LayerGroup;
  pane: string;
  selectedCounty: string | null | undefined;
  getCountyFeature: (countyName: string) => Feature<Geometry> | null;
  createGeoJsonLayer: (
    feature: Feature<Geometry>,
    pane: string,
    style: L.PathOptions,
    interactive: boolean,
  ) => L.GeoJSON;
}

/**
 * Renders the selected-county highlight polygon into the given highlights
 * group. Caller is responsible for clearing the group before invoking.
 */
export function renderSelectedCountyHighlight({
  group,
  pane,
  selectedCounty,
  getCountyFeature,
  createGeoJsonLayer,
}: RenderSelectedCountyHighlightOptions) {
  if (!selectedCounty) return;
  const selectedCountyFeature = getCountyFeature(selectedCounty);
  if (!selectedCountyFeature) return;

  const selectedLayer = createGeoJsonLayer(
    selectedCountyFeature,
    pane,
    {
      color: 'hsl(200, 60%, 50%)',
      weight: 2.5,
      fillColor: 'hsla(200, 60%, 50%, 0.08)',
      fillOpacity: 1,
    },
    false,
  );
  group.addLayer(selectedLayer);
}
