import L from 'leaflet';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { nevadaCounties } from '@/data/nevada-counties';

type GeoFeature = Feature<Polygon | MultiPolygon> | Feature<Polygon>;

interface RenderCountyPolygonsOptions {
  fillGroup: L.LayerGroup;
  borderGroup: L.LayerGroup;
  labelsGroup: L.LayerGroup | null;
  countyPolygonsPane: string;
  countyBordersPane: string;
  labelsPane: string;
  getCountyFeature: (name: string) => GeoFeature | null;
  createGeoJsonLayer: (
    geometry: GeoFeature,
    pane: string,
    style: L.PathOptions,
    interactive?: boolean,
  ) => L.GeoJSON;
  onHover: (countyName: string, event: L.LeafletMouseEvent) => void;
  onHoverClear: () => void;
  onSelect: (countyName: string, source: string, originalEvent: L.LeafletEvent) => void;
}

export function renderCountyPolygons({
  fillGroup,
  borderGroup,
  labelsGroup,
  countyPolygonsPane,
  countyBordersPane,
  labelsPane,
  getCountyFeature,
  createGeoJsonLayer,
  onHover,
  onHoverClear,
  onSelect,
}: RenderCountyPolygonsOptions) {
  fillGroup.clearLayers();
  borderGroup.clearLayers();
  labelsGroup?.clearLayers();

  nevadaCounties.forEach((county) => {
    const clipped = getCountyFeature(county.name);
    if (!clipped) return;

    const hitArea = L.geoJSON(clipped as never, {
      pane: countyPolygonsPane,
      style: {
        color: 'transparent',
        weight: 0,
        fillColor: 'hsla(200, 40%, 65%, 0.01)',
        fillOpacity: 1,
      },
      interactive: true,
      smoothFactor: 0,
    } as never);

    hitArea.on('mouseover', (event: L.LeafletMouseEvent) => {
      onHover(county.name, event);
      hitArea.setStyle({ fillColor: 'hsla(200, 40%, 65%, 0.06)' });
    });
    hitArea.on('mouseout', () => {
      onHoverClear();
      hitArea.setStyle({ fillColor: 'hsla(200, 40%, 65%, 0.01)' });
    });
    hitArea.on('click', (e: L.LeafletEvent) => {
      onSelect(county.name, 'county-hit-area', e);
    });
    fillGroup.addLayer(hitArea);

    const borderLayer = createGeoJsonLayer(
      clipped,
      countyBordersPane,
      {
        color: 'hsl(240, 5%, 80%)',
        weight: 0.75,
        opacity: 0.7,
        fillColor: 'transparent',
        fillOpacity: 0,
        dashArray: '4 4',
      },
      false,
    );
    borderGroup.addLayer(borderLayer);

    if (!labelsGroup) return;

    const label = L.divIcon({
      className: 'county-label',
      html: `<span style="
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground) / 0.58);
          white-space: nowrap;
          pointer-events: none;
          text-shadow: 0 0 2px hsl(var(--background) / 0.65);
        ">${county.name}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(county.center, {
      icon: label,
      interactive: false,
      pane: labelsPane,
    }).addTo(labelsGroup);
  });
}
