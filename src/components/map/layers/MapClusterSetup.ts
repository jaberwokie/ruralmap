import L from 'leaflet';
import { getSharedPinSvgMarkup } from '@/components/map/pinVisuals';

export type MarkerClusterGroupLike = L.LayerGroup & {
  addLayers: (layers: L.Layer[]) => void;
  clearLayers: () => void;
};

let markerClusterUnavailableWarned = false;

export const getMarkerClusterFactory = () => {
  const factory = (L as typeof L & {
    markerClusterGroup?: (options?: Record<string, unknown>) => MarkerClusterGroupLike & {
      getAllChildMarkers?: () => L.Marker[];
    };
  }).markerClusterGroup;

  if (!factory && !markerClusterUnavailableWarned) {
    markerClusterUnavailableWarned = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[MapClusterSetup] Leaflet marker clustering is unavailable (L.markerClusterGroup is not loaded). ' +
        'Clustered map pins (providers, behavioral health, services) may not render.',
    );
  }

  return factory;
};

export const getDeclutterRadiusByZoom = (zoom: number) => {
  if (zoom <= 7) return 22;
  if (zoom === 8) return 18;
  if (zoom === 9) return 14;
  if (zoom === 10) return 10;
  if (zoom === 11) return 6;
  return 4;
};

export const getClusterBadgeLabel = (count: number) => (count > 99 ? '99+' : String(count));

type ClusterableMarker = L.Marker & {
  __pointKind?: 'providerLocations' | 'servicePresence' | 'behavioralHealth';
  __providerType?: 'hospital' | 'clinic';
};

export const createPointClusterIcon = (markers: L.Marker[]) => {
  const pointMarkers = markers as ClusterableMarker[];
  const providerMarkers = pointMarkers.filter((marker) => marker.__pointKind === 'providerLocations');
  const providerCount = providerMarkers.length;
  const serviceCount = pointMarkers.filter((marker) => marker.__pointKind === 'servicePresence').length;
  const behavioralHealthCount = pointMarkers.filter((marker) => marker.__pointKind === 'behavioralHealth').length;
  const hospitalCount = providerMarkers.filter((marker) => marker.__providerType === 'hospital').length;
  const clinicCount = providerMarkers.filter((marker) => marker.__providerType === 'clinic').length;
  const totalCount = providerCount + serviceCount + behavioralHealthCount;
  const iconSize = 24;
  const categoryCounts = [
    { color: 'hsl(var(--hospital))', count: hospitalCount },
    { color: 'hsl(var(--clinic))', count: clinicCount },
    { color: 'hsl(var(--service-presence))', count: serviceCount },
    { color: 'hsl(var(--behavioral-health))', count: behavioralHealthCount },
  ].filter((entry) => entry.count > 0);
  const primaryPinColor = [...categoryCounts].sort((left, right) => right.count - left.count)[0]?.color ?? 'hsl(var(--clinic))';
  const primaryPin = getSharedPinSvgMarkup('providerLocations', 16, { color: primaryPinColor });
  const indicatorDots = categoryCounts
    .map(({ color, count }) => `<span class="cluster-marker__dot" style="--cluster-dot:${color}" aria-hidden="true" title="${count}"></span>`)
    .join('');

  const html = `
    <div class="cluster-marker-composed" data-count="${totalCount}" style="width:${iconSize + 8}px;height:${iconSize + 14}px;">
      <span class="cluster-marker-composed__pin" aria-hidden="true">${primaryPin}</span>
      <span class="cluster-marker-composed__badge" aria-hidden="true">
        <span class="cluster-marker-composed__count">${getClusterBadgeLabel(totalCount)}</span>
      </span>
      ${indicatorDots ? `<span class="cluster-marker-composed__indicators" aria-hidden="true">${indicatorDots}</span>` : ''}
    </div>
  `.trim();

  return L.divIcon({
    className: '',
    html,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize],
  });
};

const SPIDER_LEG_OPTIONS = {
  color: 'hsl(var(--border))',
  weight: 1,
  opacity: 0.85,
};

/**
 * Cluster group used for the primary facility (provider) markers.
 * Disables clustering at zoom >= 12 so individual provider pins separate
 * cleanly when the user zooms in.
 */
export const createFacilityClusterGroup = (clusterPane: string): MarkerClusterGroupLike | null => {
  const markerClusterFactory = getMarkerClusterFactory();

  return markerClusterFactory?.({
    maxClusterRadius: (zoom: number) => getDeclutterRadiusByZoom(zoom),
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: false,
    disableClusteringAtZoom: 12,
    removeOutsideVisibleBounds: false,
    animate: true,
    animateAddingMarkers: false,
    spiderfyDistanceMultiplier: 0.85,
    clusterPane,
    spiderLegPolylineOptions: SPIDER_LEG_OPTIONS,
    iconCreateFunction: (cluster: { getAllChildMarkers: () => L.Marker[] }) =>
      createPointClusterIcon(cluster.getAllChildMarkers()),
  }) ?? null;
};

/**
 * Cluster group used for the grouped (service / BH) markers. Always
 * spiderfies on max zoom so coincident shared-coordinate stacks remain
 * expandable at any zoom level.
 */
export const createGroupedPointClusterGroup = (clusterPane: string): MarkerClusterGroupLike | null => {
  const markerClusterFactory = getMarkerClusterFactory();

  return markerClusterFactory?.({
    maxClusterRadius: (zoom: number) => getDeclutterRadiusByZoom(zoom),
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    // Spiderfy any cluster the user clicks once it can't zoom any further —
    // critical for shared-coordinate stacks (e.g. city-centroid geocodes
    // where 10+ records land on the same lat/lng).
    spiderfyOnMaxZoom: true,
    // Do NOT disable clustering by zoom — coincident markers must remain
    // grouped and spiderfiable at any zoom level.
    removeOutsideVisibleBounds: false,
    animate: true,
    animateAddingMarkers: false,
    spiderfyDistanceMultiplier: 1.4,
    clusterPane,
    spiderLegPolylineOptions: SPIDER_LEG_OPTIONS,
    iconCreateFunction: (cluster: { getAllChildMarkers: () => L.Marker[] }) =>
      createPointClusterIcon(cluster.getAllChildMarkers()),
  }) ?? null;
};

/**
 * Bind a child-marker click handler on a cluster group. MarkerClusterGroup
 * intercepts DOM clicks on child markers, so individual `marker.on('click')`
 * may not fire reliably; this routes the cluster group's own event system
 * to the supplied handler.
 */
export const bindClusterChildClick = (
  cluster: MarkerClusterGroupLike | null,
  handler: (marker: L.Marker | undefined, event: L.LeafletEvent) => void,
) => {
  (cluster as unknown as { on?: (type: string, fn: (e: { layer?: L.Marker } & L.LeafletEvent) => void) => void } | null)
    ?.on?.('click', (e) => {
      handler(e.layer, e);
    });
};
