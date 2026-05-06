import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEBUG_CLICKS, debugMarkerClick, debugCountyClick, debugMapClear } from '@/components/map/debugClickOverlay';
import { DEBUG_ENABLED, SELECTION_GUARD_MS, getEntityDebugMeta, stopInteractionEvent } from '@/components/map/layers/MapInteractionUtils';
import { useBroadbandData } from '@/hooks/useBroadbandData';
import L from 'leaflet';
import { createMemberPinMarker } from './layers/MemberPinLayer';
import { addMemberRadiusRings } from './layers/MemberRadiusRingsLayer';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.heat';
import centroid from '@turf/centroid';

import { Facility, getFacilityClassification, getFacilityDataConfidence, getFacilityTypeLabel } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { enrichedRuralServices as _baseRuralServices } from '@/data/enriched-rural-services';
import { useLiveVerifiedRecords } from '@/hooks/useLiveVerifiedRecords';
import { isBehavioralHealthService, isCommunitySupportService } from '@/utils/ruralServiceClassification';
import { sameCounty } from '@/utils/countyNormalize';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import { MapEntity } from '@/types/entities';
import { getActiveCoverageZone, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { fteCapacityData, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { getCountyUtilization, getUtilizationTier, UTILIZATION_COLORS, getFacilityUtilization, getScaledPinSize, getProviderUtilizationScore, getEngagementGapCounties, getEngagementGapResults, EngagementGapResult, WASHOE_URBAN_RURAL_LAT, getFilteredEngagementPriorityCounties, getCountyEngagementMetrics, getCompositeEngagementPriority } from '@/utils/utilizationAggregation';
import { BROADBAND_BY_COUNTY, type BroadbandStatus, type OperationalBroadbandReadiness } from '@/data/broadband-coverage';
import { CELLULAR_BY_COUNTY, getReliabilityCategory, type CellularReliability, type OperationalCellularReadiness } from '@/data/cellular-coverage';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import intersect from '@turf/intersect';
import union from '@turf/union';
import { point as turfPoint, featureCollection, polygon as turfPolygon } from '@turf/helpers';
import turfArea from '@turf/area';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import MapDebugPanel from '@/components/map/MapDebugPanel';
import { collectGeometryWarnings, createLayerConflictMaps, type DebugIsolationGroup, type DebugLayerDefinition } from '@/components/map/mapDiagnostics';
import { buildFacilityValidationIndex, getFacilityCoordinateSourceLabel } from '@/utils/facilityValidation';
import { buildServiceValidationIndex } from '@/utils/serviceValidation';
import { HoverPreviewLayer, type CountyHoverPreview, type MarkerHoverPreview, type CountyHoverMetrics } from '@/components/map/layers/HoverPreviewLayer';
import { renderCountyPolygons } from '@/components/map/layers/CountyPolygonLayer';
import { MAP_PIN_VISUALS, getSharedPinSvgMarkup } from '@/components/map/pinVisuals';
import { renderProviderMarkers } from '@/components/map/layers/ProviderMarkerLayer';
import { renderBehavioralHealthMarkers } from '@/components/map/layers/BehavioralHealthMarkerLayer';
import { renderServiceMarkers } from '@/components/map/layers/ServiceMarkerLayer';
import { renderFteHubs } from '@/components/map/layers/FteOverlayLayer';
import { renderFteFieldCoverageZones } from '@/components/map/layers/FieldCoverageZoneLayer';
import { renderSelectedCountyHighlight } from '@/components/map/layers/SelectedCountyHighlightLayer';
import { renderUtilizationChoropleth } from '@/components/map/layers/UtilizationOverlayLayer';
import { renderAccessGapOverlay } from '@/components/map/layers/AccessGapOverlayLayer';
import { renderProviderRadii } from '@/components/map/layers/ProviderRadiusLayer';
import { RESPONSE_CAPABILITY_META, getResponseCapabilityCategory, getResponseCapabilityMarkerHtml } from '@/components/map/responseCapabilityVisuals';
import { getRemoteSupportMarkerLatLng, getActiveFieldMarkerLatLng } from '@/utils/remoteSupportPlacement';
import { getDriveEstimate } from '@/utils/driveEstimate';
import { getProviderAccessTierByKm } from '@/utils/providerAccessTiers';
import MemberAccessSearch from '@/components/map/MemberAccessSearch';
import type { MemberLocation, MemberAccessAnalysis } from '@/hooks/useMemberAccess';
import { getProviderClaimsMetrics } from '@/utils/providerClaimsMetrics';
import { tribalNations, ensureTribalBoundaries, type TribalNation } from '@/data/tribal-nations';
import { railCorridors, railStations } from '@/data/rail-corridors';
import { localTransitZones } from '@/data/local-transit-zones';
import { getProviderForZoneId } from '@/data/local-transit-providers';
import type { PresentationPhase } from '@/hooks/usePresentationMode';
import { usePublicSafeMode, isPublicSafeModeActive } from '@/hooks/usePublicSafeMode';

interface MapViewProps {
  facilities: Facility[];
  allFacilities?: Facility[];
  layers: {
    counties: boolean;
    services: boolean;
    behavioralHealth: boolean;
    serviceLocations: boolean;
    operationalCoverage: boolean;
    fteCapacity: boolean;
    utilizationIntensity: boolean;
    engagementGap: boolean;
    broadbandAccess: boolean;
    cellularCoverage: boolean;
    tribalNations: boolean;
    /** Additive transport overlay — defaults to false. */
    railCorridor?: boolean;
    /** Additive access-support overlay — defaults to false. */
    localTransitZones?: boolean;
    /** Tier 1 Providers highlight on existing clinic pins — defaults to false. */
    tier1Highlight?: boolean;
  };
  typeFilters?: Set<string>;
  countyFilters?: Set<string>;
  serviceCategoryFilters?: Set<string>;
  filters?: import('@/types/filters').Filters;
  onFacilityClick: (facility: Facility) => void;
  onMapClick?: () => void;
  searchQuery: string;
  radiusKm: number;
  coverageRadius: boolean;
  coverageGaps: boolean;
  onEntityClick?: (entity: MapEntity | null) => void;
  
  selectedCounty?: string | null;
  onFteHubClick?: (fteId: string) => void;
  selectedFteId?: string | null;
  /** Currently selected local transit provider id (drives zone selection styling). */
  selectedTransitProviderId?: string | null;
  /** Multi-select: every FTE id whose coverage overlay should be drawn. */
  activeFteCoverageIds?: string[];
  coverageRadiusKm?: number;
  topProvidersOnly?: boolean;
  engagementRateBelow20Only?: boolean;
  engagementGapView?: 'priority' | 'boundaries';
  memberLocation?: MemberLocation | null;
  memberAnalysis?: MemberAccessAnalysis | null;
  onMemberPlace?: (loc: MemberLocation) => void;
  onMemberClear?: () => void;
  onMemberGeocode?: (address: string) => Promise<void>;
  memberIsGeocoding?: boolean;
  memberGeocodeError?: string | null;
  memberManualMode?: boolean;
  /** Additive: external request to fit map to a bounding box. Changing identity triggers a fitBounds. */
  focusBounds?: [[number, number], [number, number]] | null;
  /** Presentation Mode demo overlay — passive, removable. */
  presentationIsPresenting?: boolean;
  presentationPhase?: PresentationPhase;
  onPresentationToggle?: () => void;
  onPresentationPhaseChange?: (phase: PresentationPhase) => void;
  /** Decision Assist drawer expanded state. Used only to deterministically
   *  offset the bottom-left Broadband/Cellular legend so it does not visually
   *  jump when the drawer expands and the layout reflows. */
  decisionAssistOpen?: boolean;
}

// Hover preview types are owned by HoverPreviewLayer.


// Member distance helpers extracted to @/lib/operational/memberAccess.
import { computeMemberDistanceInfo } from '@/lib/operational';

const RADIUS_COLORS = { stroke: 'hsla(200, 50%, 50%, 0.6)', fill: 'hsla(200, 50%, 50%, 0.10)' };

// ═══════════════════════════════════════════════════════════
// AUTHORITATIVE PANE CONFIGURATION — single source of truth
// ═══════════════════════════════════════════════════════════
import { PANE_CONFIG, MAP_PANES, initializeAllPanes, LEAFLET_UI_PANE_Z_INDEX } from '@/components/map/layers/MapPaneSetup';


const NEVADA_FEATURE: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: nevadaBoundaryGeoJSON,
};

const CLIPPED_COUNTY_FEATURES = new Map<string, Feature<Polygon | MultiPolygon>>(
  nevadaCounties.flatMap((county) => {
    const merged = mergePolygons([county.boundaries]);
    const clipped = merged ? clipPolygon(merged, NEVADA_FEATURE) : null;
    return clipped ? [[county.name, clipped] as [string, Feature<Polygon | MultiPolygon>]] : [];
  })
);

const getCountyFeature = (countyName: string) => CLIPPED_COUNTY_FEATURES.get(countyName) ?? null;


const DEBUG_LAYER_DEFINITIONS: DebugLayerDefinition[] = [
  {
    id: 'selection-highlights',
    name: 'Selection Highlights',
    source: 'clipped-counties',
    controllingToggle: 'selectedCounty / selectedFteId',
    drawOrder: 640,
    group: 'highlights',
    filterKey: 'selected-county-or-fte-service-area',
    geometryKind: 'polygon',
  },
  {
    id: 'fte-capacity-hubs',
    name: 'FTE Capacity Hubs',
    source: 'fte-capacity-hubs',
    controllingToggle: 'layers.fteCapacity',
    drawOrder: 635,
    group: 'markers',
    filterKey: 'all-fte-hubs',
    geometryKind: 'point',
  },
  {
    id: 'engagement-gap-labels',
    name: 'Engagement Gap Labels',
    source: 'engagement-gap-results',
    controllingToggle: 'layers.engagementGap',
    drawOrder: 632,
    group: 'engagement',
    filterKey: 'engagement-gap-label-icons',
    geometryKind: 'point',
  },
  {
    id: 'county-labels',
    name: 'County Labels',
    source: 'nevada-counties',
    controllingToggle: 'layers.counties',
    drawOrder: 630,
    group: 'counties',
    filterKey: 'county-centroids',
    geometryKind: 'point',
  },
  {
    id: 'service-presence-halos',
    name: 'Service Presence Halos',
    source: 'rural-services',
    controllingToggle: 'layers.services',
    drawOrder: 609,
    group: 'markers',
    filterKey: 'filtered-rural-services-halos',
    geometryKind: 'point',
  },
  {
    id: 'service-presence-markers',
    name: 'Service Presence Points',
    source: 'rural-services',
    controllingToggle: 'layers.services',
    drawOrder: 610,
    group: 'markers',
    filterKey: 'filtered-rural-services',
    geometryKind: 'point',
  },
  {
    id: 'behavioral-health-halos',
    name: 'Behavioral Health Halos',
    source: 'rural-services',
    controllingToggle: 'layers.behavioralHealth',
    drawOrder: 611,
    group: 'markers',
    filterKey: 'filtered-behavioral-health-services-halos',
    geometryKind: 'point',
  },
  {
    id: 'behavioral-health-markers',
    name: 'Behavioral Health Points',
    source: 'rural-services',
    controllingToggle: 'layers.behavioralHealth',
    drawOrder: 612,
    group: 'markers',
    filterKey: 'filtered-behavioral-health-services',
    geometryKind: 'point',
  },
  {
    id: 'operational-response-markers',
    name: 'Response Capability Markers',
    source: 'county-response-capability',
    controllingToggle: 'layers.operationalCoverage',
    drawOrder: 615,
    group: 'markers',
    filterKey: 'county-response-capability-markers',
    geometryKind: 'point',
  },
  {
    id: 'facility-markers',
    name: 'Facility Markers',
    source: 'facilities',
    controllingToggle: 'layers.serviceLocations',
    drawOrder: 620,
    group: 'markers',
    filterKey: 'filtered-facilities',
    geometryKind: 'point',
  },
  {
    id: 'engagement-gap-overlay',
    name: 'Engagement Gap Overlay',
    source: 'engagement-gap-results',
    controllingToggle: 'layers.engagementGap',
    drawOrder: 370,
    group: 'engagement',
    filterKey: 'engagement-gap-polygons',
    geometryKind: 'polygon',
  },
  {
    id: 'coverage-gap-overlay',
    name: 'Coverage Gap Overlay',
    source: 'coverage-gap-analysis',
    controllingToggle: 'coverageGaps',
    drawOrder: 365,
    group: 'engagement',
    filterKey: 'hospital-radius-gap-mask',
    geometryKind: 'polygon',
  },
  {
    id: 'drive-radius-overlay',
    name: 'Drive Radius Overlay',
    source: 'hospital-drive-radius',
    controllingToggle: 'coverageRadius',
    drawOrder: 360,
    group: 'drive',
    filterKey: 'hospitals-only',
    geometryKind: 'polygon',
  },
  {
    id: 'operational-service-area',
    name: 'Operational Service Area',
    source: 'active-coverage-zone',
    controllingToggle: 'layers.operationalCoverage',
    drawOrder: 350,
    group: 'operational',
    filterKey: 'active-coverage-zone',
    geometryKind: 'polygon',
  },
  {
    id: 'non-service-mask',
    name: 'Non-service Grey Mask',
    source: 'active-coverage-zone',
    controllingToggle: 'layers.operationalCoverage',
    drawOrder: 349,
    group: 'operational',
    filterKey: 'inactive-coverage-area',
    geometryKind: 'polygon',
  },
  {
    id: 'county-borders',
    name: 'County Borders',
    source: 'clipped-counties',
    controllingToggle: 'layers.counties',
    drawOrder: 340,
    group: 'counties',
    filterKey: 'all-counties',
    geometryKind: 'polygon',
  },
  {
    id: 'utilization-choropleth',
    name: 'Utilization Choropleth',
    source: 'clipped-counties',
    controllingToggle: 'layers.utilizationIntensity',
    drawOrder: 335,
    group: 'counties',
    filterKey: 'all-counties',
    geometryKind: 'polygon',
  },
  {
    id: 'county-hit-areas',
    name: 'County Hit Areas',
    source: 'clipped-counties',
    controllingToggle: 'layers.counties',
    drawOrder: 330,
    group: 'counties',
    filterKey: 'all-counties',
    geometryKind: 'polygon',
  },
  {
    id: 'state-outline',
    name: 'State Outline',
    source: 'nevada-boundary',
    controllingToggle: 'always-on',
    drawOrder: 320,
    group: 'state',
    filterKey: 'state-outline',
    geometryKind: 'polygon',
  },
];

const LAYER_CONFLICTS = createLayerConflictMaps(DEBUG_LAYER_DEFINITIONS);

const createGeoJsonLayer = (
  geometry: Feature<Polygon | MultiPolygon> | Feature<Polygon>,
  pane: string,
  style: L.PathOptions,
  interactive = false,
) => L.geoJSON(geometry as any, {
  pane,
  style,
  interactive,
  smoothFactor: 0,
} as any);

type PointMarkerKind = keyof Pick<typeof MAP_PIN_VISUALS, 'providerLocations' | 'servicePresence' | 'behavioralHealth'>;

type MapPointMarker = L.Marker & {
  __pointKind?: PointMarkerKind;
  __providerType?: 'hospital' | 'clinic';
  __baseZIndexOffset?: number;
  __priorityState?: 'default' | 'selected';
  __entity?: MapEntity;
  __entityType?: MapEntity['type'];
  __entityId?: string;
  __entityName?: string;
};

type PointSelectionEntity = Extract<MapEntity, { type: 'facility' | 'ruralService' }>;

type MarkerClusterGroupLike = L.LayerGroup & {
  addLayers: (layers: L.Layer[]) => void;
  clearLayers: () => void;
};

const markerClusterFactory = (L as typeof L & {
  markerClusterGroup?: (options?: Record<string, unknown>) => MarkerClusterGroupLike & {
    getAllChildMarkers?: () => L.Marker[];
  };
}).markerClusterGroup;

const POINT_MARKER_PRIORITY = {
  base: 2000,
  hoveredBoost: 1100,
  selectedBoost: 2200,
} as const;



const getDeclutterRadiusByZoom = (zoom: number) => {
  if (zoom <= 7) return 22;
  if (zoom === 8) return 18;
  if (zoom === 9) return 14;
  if (zoom === 10) return 10;
  if (zoom === 11) return 6;
  return 4;
};

const getClusterBadgeLabel = (count: number) => (count > 99 ? '99+' : String(count));

const OVERLAP_DECLUTTER_ZOOM = 11;
const NEARBY_MARKER_THRESHOLD = 0.00035;
const OVERLAP_OFFSET_RADIUS = 0.00018;

type PointRenderCandidate = {
  id: string;
  lat: number;
  lng: number;
  sortKey: string;
};

const getDisplayCoordinates = (points: PointRenderCandidate[], zoom: number) => {
  const coordinates = new Map<string, [number, number]>();

  if (zoom < OVERLAP_DECLUTTER_ZOOM) {
    points.forEach((point) => {
      coordinates.set(point.id, [point.lat, point.lng]);
    });
    return coordinates;
  }

  const groups: PointRenderCandidate[][] = [];

  [...points]
    .sort((left, right) => left.lat - right.lat || left.lng - right.lng || left.sortKey.localeCompare(right.sortKey))
    .forEach((point) => {
      const existingGroup = groups.find((group) => {
        const anchor = group[0];
        return Math.abs(anchor.lat - point.lat) <= NEARBY_MARKER_THRESHOLD
          && Math.abs(anchor.lng - point.lng) <= NEARBY_MARKER_THRESHOLD;
      });

      if (existingGroup) {
        existingGroup.push(point);
        return;
      }

      groups.push([point]);
    });

  groups.forEach((group) => {
    if (group.length === 1) {
      const [point] = group;
      coordinates.set(point.id, [point.lat, point.lng]);
      return;
    }

    // For large stacks (e.g. shared geocode centroids with 10+ records),
    // do NOT pre-spread on a tiny circle — that breaks MarkerClusterGroup's
    // ability to count and spiderfy them. Keep them on the true coordinate
    // and let the cluster layer handle expansion via its native spiderfy.
    if (group.length > 6) {
      group.forEach((point) => {
        coordinates.set(point.id, [point.lat, point.lng]);
      });
      return;
    }

    const centerLat = group.reduce((sum, point) => sum + point.lat, 0) / group.length;
    const centerLng = group.reduce((sum, point) => sum + point.lng, 0) / group.length;
    const radius = Math.min(OVERLAP_OFFSET_RADIUS + Math.max(group.length - 2, 0) * 0.00002, 0.00032);

    [...group]
      .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
      .forEach((point, index) => {
        const angle = (-Math.PI / 2) + (index * (2 * Math.PI / group.length));
        coordinates.set(point.id, [
          centerLat + Math.sin(angle) * radius,
          centerLng + Math.cos(angle) * radius,
        ]);
      });
  });

  return coordinates;
};

const createPointClusterIcon = (markers: L.Marker[]) => {
  const pointMarkers = markers as MapPointMarker[];
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

// Hover preview helpers (numberFormatter, county display name, severity,
// metric row, info button) live in HoverPreviewLayer.




const MapView = ({ facilities, allFacilities, layers, typeFilters, countyFilters, serviceCategoryFilters, filters: externalFilters, onFacilityClick, onMapClick, searchQuery, radiusKm, coverageRadius, coverageGaps, onEntityClick, selectedCounty, onFteHubClick, selectedFteId, selectedTransitProviderId = null, activeFteCoverageIds = [], coverageRadiusKm = 120, topProvidersOnly = false, engagementRateBelow20Only = false, engagementGapView = 'priority', memberLocation, memberAnalysis, onMemberPlace, onMemberClear, onMemberGeocode, memberIsGeocoding = false, memberGeocodeError = null, memberManualMode = false, focusBounds = null, presentationIsPresenting = false, presentationPhase = 1, onPresentationToggle, onPresentationPhaseChange, decisionAssistOpen = false }: MapViewProps) => {
  const { broadbandReady } = useBroadbandData();
  const { isPublicSafe } = usePublicSafeMode();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointClusterRef = useRef<MarkerClusterGroupLike | null>(null);
  const selectedPointMarkerRef = useRef<MapPointMarker | null>(null);
  const markersRef = useRef<MarkerClusterGroupLike | null>(null);
  const topProviderMarkersRef = useRef<L.LayerGroup | null>(null);
  const servicePresenceHaloRef = useRef<L.LayerGroup | null>(null);
  const servicePresenceMarkerRef = useRef<L.LayerGroup | null>(null);
  const behavioralHealthHaloRef = useRef<L.LayerGroup | null>(null);
  const behavioralHealthMarkerRef = useRef<L.LayerGroup | null>(null);
  const countyFillRef = useRef<L.LayerGroup | null>(null);
  const countyBorderRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const broadbandRef = useRef<L.LayerGroup | null>(null);
  const cellularRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const gapsRef = useRef<L.LayerGroup | null>(null);
  const stateBoundaryRef = useRef<L.LayerGroup | null>(null);
  const coverageGreyRef = useRef<L.LayerGroup | null>(null);
  const operationalCoverageRef = useRef<L.LayerGroup | null>(null);
  const operationalResponseMarkerRef = useRef<L.LayerGroup | null>(null);
  const fteCapacityRef = useRef<L.LayerGroup | null>(null);
  const utilizationRef = useRef<L.LayerGroup | null>(null);
  const engagementGapRef = useRef<L.LayerGroup | null>(null);
  const engagementPriorityRef = useRef<L.LayerGroup | null>(null);
  const engagementGapLabelRef = useRef<L.LayerGroup | null>(null);
  const engagementHeatRef = useRef<L.Layer | null>(null);
  const highlightsRef = useRef<L.LayerGroup | null>(null);
  const tribalNationsRef = useRef<L.LayerGroup | null>(null);
  const memberPinRef = useRef<L.LayerGroup | null>(null);
  const memberRingsRef = useRef<L.LayerGroup | null>(null);
  const railLayerRef = useRef<L.LayerGroup | null>(null);
  const localTransitLayerRef = useRef<L.LayerGroup | null>(null);
  const [tribalBoundariesReady, setTribalBoundariesReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(7);
  const [debugOpen, setDebugOpen] = useState(false);
  const [facilityValidationMode, setFacilityValidationMode] = useState(false);
  const [countyHoverPreview, setCountyHoverPreview] = useState<CountyHoverPreview | null>(null);
  const [markerHoverPreview, setMarkerHoverPreview] = useState<MarkerHoverPreview | null>(null);
  const markerHoverPreviewRef = useRef((preview: MarkerHoverPreview | null) => {
    setMarkerHoverPreview(preview);
  });
  const [layerVisibilityOverrides, setLayerVisibilityOverrides] = useState<Record<string, boolean>>({});
  const [isolatedLayerId, setIsolatedLayerId] = useState<string | null>(null);
  const [isolatedGroup, setIsolatedGroup] = useState<DebugIsolationGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onEntityClickRef = useRef(onEntityClick);
  onEntityClickRef.current = onEntityClick;
  const onFteHubClickRef = useRef(onFteHubClick);
  onFteHubClickRef.current = onFteHubClick;
  const onMemberPlaceRef = useRef(onMemberPlace);
  onMemberPlaceRef.current = onMemberPlace;
  const memberManualModeRef = useRef(memberManualMode);
  memberManualModeRef.current = memberManualMode;
  const memberLocationRef = useRef(memberLocation);
  memberLocationRef.current = memberLocation;

  const getMemberDistanceInfo = useCallback((targetLat: number, targetLng: number): { memberDistanceMi: number; memberTierLabel: string } | null => {
    const ml = memberLocationRef.current;
    if (!ml) return null;
    return computeMemberDistanceInfo(ml.lat, ml.lng, targetLat, targetLng);
  }, []);
  const interactionGuardUntilRef = useRef(0);
  const markerGuardUntilRef = useRef(0);
  const selectPointMarkerRef = useRef<(marker: MapPointMarker | null) => void>(() => {});
  const clearSelectedPointMarkerRef = useRef<() => void>(() => {});

  const logMapSelectionDebug = useCallback((phase: string, entity: MapEntity | null | undefined = null, extra: Record<string, unknown> = {}) => {
    if (!DEBUG_ENABLED) return;
    console.info('[Map Selection Debug]', {
      phase,
      ...getEntityDebugMeta(entity),
      ...extra,
    });
  }, []);


  const guardRefs = { interactionGuardUntil: interactionGuardUntilRef, markerGuardUntil: markerGuardUntilRef };
  const armInteractionGuard = useCallback((source: 'marker' | 'county' | 'overlay') => {
    armSelectionGuard(guardRefs, source);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveInteractionGuard = useCallback(() => isInteractionGuardActive(guardRefs), []);
  const hasActiveMarkerGuard = useCallback(() => isMarkerGuardActive(guardRefs), []);

  const selectMarkerEntity = useCallback((entity: PointSelectionEntity | null | undefined, source: string, originalEvent?: L.LeafletEvent | Event | null, marker?: MapPointMarker | null) => {
    if (!entity) {
      logMapSelectionDebug('marker-selection-skipped', null, { source, reason: 'missing-entity' });
      return;
    }
    logMapSelectionDebug('marker-click-received', entity, { source });
    stopInteractionEvent(originalEvent);
    armInteractionGuard('marker');
    if (marker) selectPointMarkerRef.current(marker);
    logMapSelectionDebug('selectMarkerEntity-called', entity, { source });
    const eName = (entity as any)?.facility?.name ?? (entity as any)?.service?.name ?? (entity as any)?.name ?? 'unknown';
    const eType = (entity as any)?.type ?? 'unknown';
    debugMarkerClick(eType, eName, marker);
    onEntityClickRef.current?.(entity);
  }, [armInteractionGuard, logMapSelectionDebug, stopInteractionEvent]);

  // Stable ref so group-level handlers (bound once at map init) always
  // call the latest selectMarkerEntity without stale closures.
  const selectMarkerEntityRef = useRef(selectMarkerEntity);
  selectMarkerEntityRef.current = selectMarkerEntity;

  const selectCountyEntity = useCallback((county: string | null | undefined, source: string, originalEvent?: L.LeafletEvent | Event | null) => {
    if (!county) return;
    const entity: MapEntity = { type: 'county', county };
    if (hasActiveMarkerGuard()) {
      stopInteractionEvent(originalEvent);
      logMapSelectionDebug('county-click-ignored-due-to-marker-guard', entity, { source });
      return;
    }
    stopInteractionEvent(originalEvent);
    armInteractionGuard('county');
    clearSelectedPointMarkerRef.current();
    logMapSelectionDebug('selectCountyEntity-called', entity, { source });
    debugCountyClick(county);
    onEntityClickRef.current?.(entity);
  }, [armInteractionGuard, hasActiveMarkerGuard, logMapSelectionDebug, stopInteractionEvent]);

  const selectOverlayEntity = useCallback((entity: MapEntity | null | undefined, source: string, originalEvent?: L.LeafletEvent | Event | null) => {
    if (!entity) return;
    stopInteractionEvent(originalEvent);
    armInteractionGuard('overlay');
    clearSelectedPointMarkerRef.current();
    logMapSelectionDebug('overlay-selection', entity, { source });
    onEntityClickRef.current?.(entity);
  }, [armInteractionGuard, logMapSelectionDebug, stopInteractionEvent]);

  const filteredFacilities = useMemo(() => {
    let result = facilities;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.city.toLowerCase().includes(q) ||
        f.county.toLowerCase().includes(q)
      );
    }
    return result;
  }, [facilities, searchQuery]);

  const providerFacilities = useMemo(() => allFacilities ?? facilities, [allFacilities, facilities]);
  const providerMarkerFacilities = useMemo(() => facilities, [facilities]);

  // Detect if any service-line filter is active — if so, suppress rural service pins
  const hasServiceLineFilter = !!(
    externalFilters?.psychiatry || externalFilters?.verifiedPsychiatryOnly ||
    externalFilters?.acceptingPsychPatients || externalFilters?.telepsychiatry ||
    externalFilters?.inpatientServices || externalFilters?.verifiedInpatientOnly ||
    externalFilters?.psychiatricInpatient || externalFilters?.detoxInpatient ||
    externalFilters?.acceptingAdmissions || externalFilters?.medicaidInpatient
  );


  const providerFilteredFacilities = useMemo(() => {
    let result = providerMarkerFacilities.filter((facility) => Number.isFinite(facility.lat) && Number.isFinite(facility.lng));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((facility) =>
        facility.name.toLowerCase().includes(q)
        || facility.city.toLowerCase().includes(q)
        || facility.county.toLowerCase().includes(q)
      );
    }

    if (countyFilters && countyFilters.size > 0) {
      result = result.filter((facility) => countyFilters.has(facility.county));
    }

    if (typeFilters && typeFilters.size > 0) {
      const providerTypeFilters = new Set(
        [...typeFilters].filter((type) => type === 'hospital' || type === 'clinic')
      );

      if (providerTypeFilters.size > 0) {
        result = result.filter((facility) => {
          if (facility.type !== 'hospital' && facility.type !== 'clinic') return false;
          return providerTypeFilters.has(facility.type);
        });
      }
    }

    // Dev validation: log psychiatry filter pipeline
    if (import.meta.env.DEV && hasServiceLineFilter) {
      console.info('[ServiceLine Filter] Facility pipeline:', {
        totalBase: providerMarkerFacilities.length,
        afterMapViewFilters: result.length,
        hasServiceLineFilter,
        sample: result.slice(0, 5).map(f => ({ name: f.name, type: f.type, hasPsych: !!f.psychiatric, hasInpatient: !!f.inpatient })),
      });
    }

    return result;
  }, [providerMarkerFacilities, searchQuery, countyFilters, typeFilters, hasServiceLineFilter]);

  const topProvidersVisible = useMemo(() => {
    const scored = providerFilteredFacilities.map((facility) => ({
      facility,
      score: getProviderUtilizationScore(facility.name),
    }));

    scored.sort((a, b) => b.score - a.score || a.facility.name.localeCompare(b.facility.name) || a.facility.id.localeCompare(b.facility.id));

    const top20 = scored.slice(0, 20).map((entry) => entry.facility);

    if (import.meta.env.DEV) {
      console.info('[Top 20 Debug][Raw→Ranked]', {
        filteredRawProviderCount: providerFilteredFacilities.length,
        top20Count: top20.length,
        top20Providers: top20.map((facility) => ({
          id: facility.id,
          name: facility.name,
          score: getProviderUtilizationScore(facility.name),
        })),
      });
    }

    return top20;
  }, [providerFilteredFacilities]);

  const providerVisibleFacilities = useMemo(
    () => (topProvidersOnly ? topProvidersVisible : providerFilteredFacilities),
    [providerFilteredFacilities, topProvidersOnly, topProvidersVisible],
  );

  // Live-merge promoted verified Service + BH records on top of the static dataset.
  // Verified rows take precedence on (name + 4-decimal coord) collisions.
  const { records: liveVerifiedRecords } = useLiveVerifiedRecords();
  const ruralServices = useMemo(() => {
    if (liveVerifiedRecords.length === 0) return _baseRuralServices;
    const dedupKey = (n: string, lat: number, lng: number) =>
      `${n.trim().toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    const liveKeys = new Set(liveVerifiedRecords.map(r => dedupKey(r.name, r.lat, r.lng)));
    const baseFiltered = _baseRuralServices.filter(s => !liveKeys.has(dedupKey(s.name, s.lat, s.lng)));
    return [...baseFiltered, ...liveVerifiedRecords];
  }, [liveVerifiedRecords]);

  const facilityValidation = useMemo(() => buildFacilityValidationIndex(providerFacilities), [providerFacilities]);
  const serviceValidation = useMemo(() => buildServiceValidationIndex(ruralServices), [ruralServices]);


  const filteredRuralServices = useMemo(() => {
    // When a psychiatric or inpatient filter is active, rural services cannot match — suppress all
    if (hasServiceLineFilter) {
      if (import.meta.env.DEV) {
        console.info('[ServiceLine Filter] Suppressing rural service pins — service-line filter active');
      }
      return [];
    }

    let result = ruralServices;

    if (typeFilters && typeFilters.size > 0 && !typeFilters.has('service') && !typeFilters.has('behavioralHealth')) {
      return [];
    }

    if (countyFilters && countyFilters.size > 0) {
      // Use canonical county comparison so live-imported rows whose stored
      // county is e.g. "Nye County" still match the "Nye" filter key.
      result = result.filter((service) =>
        Array.from(countyFilters).some((c) => sameCounty(service.county, c)),
      );
    }

    // County review scoping: when a county is selected via the map/sidebar,
    // narrow the Services pin set to that county so the map matches the
    // Local Resource Network panel one-for-one. This applies on top of any
    // explicit countyFilters chip selection.
    if (selectedCounty) {
      result = result.filter((service) => sameCounty(service.county, selectedCounty));
    }

    if (serviceCategoryFilters && serviceCategoryFilters.size > 0) {
      result = result.filter((service) => serviceCategoryFilters.has(service.category));
    }

    if (import.meta.env.DEV && selectedCounty) {
      // Dev-only parity probe: compare this count against the Local Resource
      // Network panel for the same county. They must match.
      // eslint-disable-next-line no-console
      console.info(
        `[Services parity] selectedCounty=${selectedCounty} ruralServices=${ruralServices.length} filtered=${result.length}`,
      );
    }

    return result;
  }, [countyFilters, hasServiceLineFilter, ruralServices, selectedCounty, serviceCategoryFilters, typeFilters]);

  const filteredCommunityServices = useMemo(() => {
    if (hasServiceLineFilter) return [];
    if (typeFilters && typeFilters.size > 0 && !typeFilters.has('service')) {
      return [];
    }

    return filteredRuralServices.filter(isCommunitySupportService);
  }, [filteredRuralServices, hasServiceLineFilter, typeFilters]);

  const filteredBehavioralHealthServices = useMemo(() => {
    if (hasServiceLineFilter) return [];
    if (typeFilters && typeFilters.size > 0 && !typeFilters.has('behavioralHealth')) {
      return [];
    }

    return filteredRuralServices.filter(isBehavioralHealthService);
  }, [filteredRuralServices, hasServiceLineFilter, typeFilters]);

  const countyHoverMetrics = useMemo(() => {
    const metricsByCounty = new Map<string, CountyHoverMetrics>();
    const providerCountByCounty = providerFacilities.reduce((acc, facility) => {
      acc.set(facility.county, (acc.get(facility.county) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
    const serviceCountByCounty = filteredRuralServices.reduce((acc, service) => {
      acc.set(service.county, (acc.get(service.county) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const coverageBuffers = providerFacilities
      .filter((facility) => Number.isFinite(facility.lat) && Number.isFinite(facility.lng))
      .map((facility) => buffer(turfPoint([facility.lng, facility.lat]), radiusKm, { units: 'kilometers' }) as Feature<Polygon>);

    const mergedCoverage = coverageBuffers.length === 0
      ? null
      : (union(featureCollection(coverageBuffers) as any) as Feature<Polygon | MultiPolygon> | null)
        ?? ({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: coverageBuffers.map((feature) => feature.geometry.coordinates),
          },
        } as Feature<MultiPolygon>);

    nevadaCounties.forEach(({ name }) => {
      const metric: CountyHoverMetrics = { county: name };
      const totalMembers = memberVolumeData.find((entry) => entry.county === name)?.memberCount;
      if (typeof totalMembers === 'number') {
        metric.totalMembers = totalMembers;
      }

      const engagement = getCountyEngagementMetrics(name);
      if (engagement.totalMembers > 0) {
        metric.unengagedMembers = engagement.unengagedMembers;
      }

      const providerCount = providerCountByCounty.get(name);
      if (typeof providerCount === 'number') {
        metric.providerCount = providerCount;
      }

       const serviceCount = serviceCountByCounty.get(name);
       if (typeof serviceCount === 'number') {
         metric.serviceCount = serviceCount;
       }

      const countyFeature = getCountyFeature(name);
      if (countyFeature) {
        const countyArea = turfArea(countyFeature as any);
        if (countyArea > 0) {
          let coveredArea = 0;
          if (mergedCoverage) {
            try {
              const coverageWithinCounty = intersect(featureCollection([countyFeature, mergedCoverage]) as any);
              if (coverageWithinCounty) {
                coveredArea = turfArea(coverageWithinCounty as any);
              }
            } catch {
              coveredArea = 0;
            }
          }

          metric.coverageGapPercent = Math.max(0, Math.min(100, Math.round(((countyArea - coveredArea) / countyArea) * 100)));
        }
      }

      const bbData = BROADBAND_BY_COUNTY.get(name);
      if (bbData) {
        metric.broadbandStatus = bbData.broadbandStatus;
        metric.pct_100_20_plus = bbData.pct_100_20_plus;
        metric.pct_25_3_to_100_20 = bbData.pct_25_3_to_100_20;
        metric.pct_below_25_3 = bbData.pct_below_25_3;
        metric.broadbandReadiness = bbData.operationalReadiness;
        metric.broadbandSatelliteShare = bbData.satelliteShare;
        metric.broadbandUneven = bbData.coverageUnevenness;
      }

      const cellData = CELLULAR_BY_COUNTY.get(name);
      if (cellData) {
        metric.cellularReadiness = cellData.operationalCellularReadiness;
        metric.cellularLtePct = cellData.lteCoveragePct;
        metric.cellularFiveGPct = cellData.fiveGCoveragePct;
      }

      metricsByCounty.set(name, metric);
    });

    return metricsByCounty;
  }, [filteredRuralServices, providerFacilities, radiusKm, broadbandReady]);

  const updateCountyHoverPreview = useCallback((county: string, _event?: L.LeafletMouseEvent) => {
    const metrics = countyHoverMetrics.get(county) ?? { county };
    setCountyHoverPreview({ ...metrics, county });
  }, [countyHoverMetrics]);

  const clearCountyHoverPreview = useCallback(() => {
    setCountyHoverPreview(null);
  }, []);

  const ruralServicesByCounty = useMemo(() => {
    const grouped = new Map<string, typeof ruralServices>();
    ruralServices.forEach((service) => {
      const current = grouped.get(service.county) ?? [];
      current.push(service);
      grouped.set(service.county, current);
    });
    return grouped;
  }, []);

  const communityServicesByCounty = useMemo(() => {
    const grouped = new Map<string, typeof ruralServices>();
    filteredCommunityServices.forEach((service) => {
      const current = grouped.get(service.county) ?? [];
      current.push(service);
      grouped.set(service.county, current);
    });
    return grouped;
  }, [filteredCommunityServices]);

  const behavioralHealthServicesByCounty = useMemo(() => {
    const grouped = new Map<string, typeof ruralServices>();
    filteredBehavioralHealthServices.forEach((service) => {
      const current = grouped.get(service.county) ?? [];
      current.push(service);
      grouped.set(service.county, current);
    });
    return grouped;
  }, [filteredBehavioralHealthServices]);

  const activeCoverageZone = useMemo(() => {
    if (!layers.operationalCoverage || coverageGaps) return null;
    return getActiveCoverageZone(coverageRadiusKm);
  }, [layers.operationalCoverage, coverageGaps, coverageRadiusKm]);

  const engagementPriorityCounties = useMemo(
    () => getFilteredEngagementPriorityCounties(engagementRateBelow20Only ? { belowRateThreshold: 0.2 } : {}),
    [engagementRateBelow20Only],
  );

  const maxPriorityUnengagedMembers = engagementPriorityCounties[0]?.unengagedMembers ?? 0;

  const layerGroups = useMemo(
    () => ({
      'state-outline': stateBoundaryRef.current,
      'county-hit-areas': countyFillRef.current,
      'utilization-choropleth': utilizationRef.current,
      'county-borders': countyBorderRef.current,
      'non-service-mask': coverageGreyRef.current,
      'operational-service-area': operationalCoverageRef.current,
      'operational-response-markers': operationalResponseMarkerRef.current,
      'drive-radius-overlay': radiusRef.current,
      'coverage-gap-overlay': gapsRef.current,
      'engagement-gap-overlay': engagementGapRef.current,
      'engagement-priority-overlay': engagementPriorityRef.current,
      'service-presence-halos': servicePresenceHaloRef.current,
      'service-presence-markers': servicePresenceMarkerRef.current,
      'behavioral-health-halos': behavioralHealthHaloRef.current,
      'behavioral-health-markers': behavioralHealthMarkerRef.current,
      'facility-markers': topProvidersOnly ? topProviderMarkersRef.current : markersRef.current,
      'county-labels': labelsRef.current,
      'engagement-gap-labels': engagementGapLabelRef.current,
      'fte-capacity-hubs': fteCapacityRef.current,
      'selection-highlights': highlightsRef.current,
    }),
    [mapReady, topProvidersOnly],
  );

  const isLayerVisibleInDebug = useCallback(
    (definition: DebugLayerDefinition) => {
      const manualVisible = layerVisibilityOverrides[definition.id] ?? true;
      const isolatedLayerVisible = !isolatedLayerId || isolatedLayerId === definition.id;
      const isolatedGroupVisible = !isolatedGroup || isolatedGroup === definition.group;
      return manualVisible && isolatedLayerVisible && isolatedGroupVisible;
    },
    [isolatedGroup, isolatedLayerId, layerVisibilityOverrides],
  );

  const isLayerEnabledByToggle = useCallback((definition: DebugLayerDefinition) => {
    switch (definition.controllingToggle) {
      case 'layers.counties':
        return layers.counties;
      case 'layers.services':
        return layers.services;
      case 'layers.behavioralHealth':
        return layers.behavioralHealth;
      case 'layers.serviceLocations':
        return layers.serviceLocations || topProvidersOnly;
      case 'layers.operationalCoverage':
        return layers.operationalCoverage;
      case 'layers.fteCapacity':
        return layers.fteCapacity;
      case 'layers.utilizationIntensity':
        return layers.utilizationIntensity;
      case 'layers.engagementGap':
        return layers.engagementGap;
      case 'coverageRadius':
        return coverageRadius;
      case 'coverageGaps':
        return coverageGaps;
      case 'selectedCounty / selectedFteId':
        return Boolean(selectedCounty || selectedFteId);
      case 'always-on':
      default:
        return true;
    }
  }, [coverageGaps, coverageRadius, layers.behavioralHealth, layers.counties, layers.engagementGap, layers.fteCapacity, layers.operationalCoverage, layers.serviceLocations, layers.services, layers.utilizationIntensity, selectedCounty, selectedFteId, topProvidersOnly]);

  const geometryWarnings = useMemo(() => {
    if (!DEBUG_ENABLED || !debugOpen) {
      return { warnings: [], overlappingSources: new Set<string>() };
    }

    return collectGeometryWarnings(
      [
        { source: 'nevada-boundary', features: [NEVADA_FEATURE], allowOverlap: true },
        { source: 'clipped-counties', features: Array.from(CLIPPED_COUNTY_FEATURES.values()) },
        {
          source: 'active-coverage-zone',
          features: activeCoverageZone ? [activeCoverageZone] : [],
          allowOverlap: true,
        },
        {
          source: 'fte-capacity-hubs',
          features: fteCapacityData
            .filter((fte) => !!fte.hubLocation)
            .map((fte) => ({
              type: 'Feature' as const,
              properties: { id: fte.id },
              geometry: {
                type: 'Point' as const,
                coordinates: [fte.hubLocation!.lng, fte.hubLocation!.lat],
              },
            })),
          allowOverlap: true,
        },
        {
          source: 'facilities',
          features: facilities.map((facility) => ({
            type: 'Feature' as const,
            properties: { id: facility.id },
            geometry: {
              type: 'Point' as const,
              coordinates: [facility.lng, facility.lat],
            },
          })),
          allowOverlap: true,
        },
      ],
      NEVADA_FEATURE,
    );
  }, [activeCoverageZone, debugOpen, facilities]);

  const debugLayers = useMemo(() => {
    if (!DEBUG_ENABLED || !debugOpen || !mapRef.current) return [];

    return [...DEBUG_LAYER_DEFINITIONS]
      .sort((left, right) => right.drawOrder - left.drawOrder)
      .map((definition) => {
        const group = layerGroups[definition.id as keyof typeof layerGroups];
        const rendered = !!group && group.getLayers().length > 0;
        const visible = !!group && mapRef.current ? mapRef.current.hasLayer(group) : false;

        return {
          ...definition,
          visible,
          rendered,
          duplicateSource: LAYER_CONFLICTS.duplicateSources.has(definition.source),
          duplicateFilter: LAYER_CONFLICTS.duplicateFilters.has(`${definition.source}::${definition.filterKey}`),
          geometryConflict: geometryWarnings.overlappingSources.has(definition.source),
        };
      });
  }, [debugOpen, geometryWarnings.overlappingSources, layerGroups]);

  const toggleDebugLayer = useCallback((layerId: string) => {
    setLayerVisibilityOverrides((current) => ({
      ...current,
      [layerId]: !(current[layerId] ?? true),
    }));
  }, []);

  const isolateDebugLayer = useCallback((layerId: string) => {
    setIsolatedGroup(null);
    setIsolatedLayerId((current) => (current === layerId ? null : layerId));
  }, []);

  const isolateDebugGroup = useCallback((group: DebugIsolationGroup) => {
    setIsolatedLayerId(null);
    setIsolatedGroup((current) => (current === group ? null : group));
  }, []);

  const clearDebugIsolation = useCallback(() => {
    setLayerVisibilityOverrides({});
    setIsolatedLayerId(null);
    setIsolatedGroup(null);
  }, []);

  useEffect(() => {
    if (!DEBUG_ENABLED) return;

    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (isTypingTarget) return;

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setDebugOpen((current) => !current);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    if (debugOpen) return;
    clearDebugIsolation();
    setFacilityValidationMode(false);
  }, [clearDebugIsolation, debugOpen]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const DEFAULT_CENTER: L.LatLngTuple = [39.5, -117.0];
    const DEFAULT_ZOOM = 7;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    // Unified control stack: Recenter + Zoom In + Zoom Out
    const MapControlStack = L.Control.extend({
      options: { position: 'bottomright' as L.ControlPosition },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';

        const makeBtn = (title: string, ariaLabel: string, innerHTML: string, onClick: () => void) => {
          const btn = L.DomUtil.create('a', '', container) as HTMLAnchorElement;
          btn.href = '#';
          btn.title = title;
          btn.setAttribute('role', 'button');
          btn.setAttribute('aria-label', ariaLabel);
          btn.innerHTML = innerHTML;
          btn.style.display = 'flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.width = '30px';
          btn.style.height = '30px';
          btn.style.lineHeight = '30px';
          btn.style.fontSize = '18px';
          btn.style.textDecoration = 'none';
          btn.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
          L.DomEvent.on(btn, 'click', (e) => { L.DomEvent.preventDefault(e); onClick(); });
          return btn;
        };

        makeBtn(
          'Recenter Map', 'Recenter Map',
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>',
          () => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true, duration: 0.4 }),
        );
        makeBtn('Zoom in', 'Zoom in', '<span aria-hidden="true">+</span>', () => map.zoomIn());
        const lastBtn = makeBtn('Zoom out', 'Zoom out', '<span aria-hidden="true">−</span>', () => map.zoomOut());
        lastBtn.style.borderBottom = 'none';

        L.DomEvent.disableClickPropagation(container);
        return container;
      },
    });
    new MapControlStack().addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Strict pane hierarchy prevents path/marker draw-order drift as layers toggle on/off.
    // Marker panes must use pointer-events: none so higher-z empty panes
    // don't block clicks on markers in lower-z panes. Individual marker
    // icons already have pointer-events: auto via Leaflet defaults.
    // ALL custom panes use pointer-events: none on the pane <div>.
    // This prevents higher-z panes from blocking clicks on lower-z panes.
    // Interactive elements get pointer-events restored at the element level:
    // Initialize all panes from the single authoritative PANE_CONFIG
    initializeAllPanes(map);

    const markerPane = map.getPane('markerPane');
    const tooltipPane = map.getPane('tooltipPane');
    const popupPane = map.getPane('popupPane');

    if (markerPane) markerPane.style.zIndex = String(LEAFLET_UI_PANE_Z_INDEX.markerPane);
    if (tooltipPane) tooltipPane.style.zIndex = String(LEAFLET_UI_PANE_Z_INDEX.tooltipPane);
    if (popupPane) popupPane.style.zIndex = String(LEAFLET_UI_PANE_Z_INDEX.popupPane);

    // Rendering hierarchy:
    // Base map → state outline → county polygons → county borders → operational areas
    // → drive radii → gap/engagement overlays → grouped markers → individual markers → labels → highlights
    // → Leaflet tooltips/popups.
    stateBoundaryRef.current = L.layerGroup().addTo(map);
    countyFillRef.current = L.layerGroup().addTo(map);
    utilizationRef.current = L.layerGroup().addTo(map);
    countyBorderRef.current = L.layerGroup().addTo(map);
    broadbandRef.current = L.layerGroup().addTo(map);
    cellularRef.current = L.layerGroup().addTo(map);
    tribalNationsRef.current = L.layerGroup().addTo(map);
    coverageGreyRef.current = L.layerGroup().addTo(map);
    operationalCoverageRef.current = L.layerGroup().addTo(map);
    operationalResponseMarkerRef.current = L.layerGroup().addTo(map);
    radiusRef.current = L.layerGroup().addTo(map);
    gapsRef.current = L.layerGroup().addTo(map);
    engagementGapRef.current = L.layerGroup().addTo(map);
    engagementPriorityRef.current = L.layerGroup().addTo(map);
    servicePresenceHaloRef.current = L.featureGroup().addTo(map);
    servicePresenceMarkerRef.current = L.featureGroup().addTo(map);
    behavioralHealthHaloRef.current = L.featureGroup().addTo(map);
    behavioralHealthMarkerRef.current = L.featureGroup().addTo(map);
    markersRef.current = markerClusterFactory?.({
      maxClusterRadius: (zoom: number) => getDeclutterRadiusByZoom(zoom),
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: false,
      disableClusteringAtZoom: 12,
      removeOutsideVisibleBounds: false,
      animate: true,
      animateAddingMarkers: false,
      spiderfyDistanceMultiplier: 0.85,
      clusterPane: MAP_PANES.facilityMarkers,
      spiderLegPolylineOptions: {
        color: 'hsl(var(--border))',
        weight: 1,
        opacity: 0.85,
      },
      iconCreateFunction: (cluster: { getAllChildMarkers: () => L.Marker[] }) => createPointClusterIcon(cluster.getAllChildMarkers()),
    }) ?? null;
    markersRef.current?.addTo(map);

    // Facility cluster group click handler — uses stable ref
    (markersRef.current as any)?.on?.('click', (e: any) => {
      const marker = e.layer as MapPointMarker | undefined;
      selectMarkerEntityRef.current(marker?.__entity as PointSelectionEntity | undefined, 'facility-cluster-marker', e, marker);
    });
    topProviderMarkersRef.current = L.layerGroup().addTo(map);
    pointClusterRef.current = markerClusterFactory?.({
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
      clusterPane: MAP_PANES.groupedMarkers,
      spiderLegPolylineOptions: {
        color: 'hsl(var(--border))',
        weight: 1,
        opacity: 0.85,
      },
      iconCreateFunction: (cluster: { getAllChildMarkers: () => L.Marker[] }) => createPointClusterIcon(cluster.getAllChildMarkers()),
    }) ?? null;
    pointClusterRef.current?.addTo(map);

    // Handle clicks on individual markers inside the cluster group.
    // MarkerClusterGroup intercepts DOM clicks on child markers; individual
    // marker.on('click') may not fire reliably. This listener catches all
    // child-marker clicks via the cluster group's own event system.
    // Uses stable ref to avoid stale closure (bound once at map init).
    (pointClusterRef.current as any)?.on?.('click', (e: any) => {
      const marker = e.layer as MapPointMarker | undefined;
      selectMarkerEntityRef.current(marker?.__entity as PointSelectionEntity | undefined, 'cluster-group-click', e, marker);
    });
    fteCapacityRef.current = L.layerGroup().addTo(map);
    labelsRef.current = L.layerGroup().addTo(map);
    engagementGapLabelRef.current = L.layerGroup().addTo(map);
    highlightsRef.current = L.layerGroup().addTo(map);
    memberRingsRef.current = L.layerGroup().addTo(map);
    memberPinRef.current = L.layerGroup().addTo(map);
    railLayerRef.current = L.layerGroup().addTo(map);
    localTransitLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setMapZoom(map.getZoom());
    setMapReady(true);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (hasActiveInteractionGuard()) {
        logMapSelectionDebug('background-click-ignored-due-to-guard');
        return;
      }
      // Manual member placement mode
      if (memberManualModeRef.current && onMemberPlaceRef.current) {
        onMemberPlaceRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      clearSelectedPointMarkerRef.current();
      logMapSelectionDebug('background-click-clear-executed', null, { source: 'map-background' });
      debugMapClear();
      onMapClickRef.current?.();
    });
    map.on('zoomend', () => setMapZoom(map.getZoom()));

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tribal nation polygon boundaries
  useEffect(() => {
    ensureTribalBoundaries().then(() => setTribalBoundariesReady(true));
  }, []);

  // Clip the drive-radii pane to the Nevada boundary so radius circles never
  // visually spill into neighboring states. Pure SVG clip — radius math,
  // gap detection, and pane stacking are untouched.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const pane = map.getPane(PANE_CONFIG.driveRadiiAbove.id);
    if (!pane) return;
    const svg = pane.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const CLIP_ID = 'nevada-radii-clip';

    // Create <defs><clipPath id><path/></clipPath></defs>
    let defs = svg.querySelector('defs') as SVGDefsElement | null;
    let createdDefs = false;
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
      createdDefs = true;
    }
    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', CLIP_ID);
    clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const clipPathEl = document.createElementNS(SVG_NS, 'path');
    clipPath.appendChild(clipPathEl);
    defs.appendChild(clipPath);

    // Apply clip to the pane's overlay <g>
    const overlayG = svg.querySelector('g') as SVGGElement | null;
    const prevClip = overlayG?.getAttribute('clip-path') ?? null;
    if (overlayG) overlayG.setAttribute('clip-path', `url(#${CLIP_ID})`);

    const coords = nevadaBoundaryGeoJSON.coordinates[0] as [number, number][];

    const updateClip = () => {
      let d = '';
      for (let i = 0; i < coords.length; i++) {
        const [lng, lat] = coords[i];
        const pt = map.latLngToLayerPoint([lat, lng]);
        d += (i === 0 ? 'M' : 'L') + pt.x + ',' + pt.y;
      }
      d += 'Z';
      clipPathEl.setAttribute('d', d);
    };

    updateClip();
    map.on('zoomend moveend viewreset zoom', updateClip);

    return () => {
      map.off('zoomend moveend viewreset zoom', updateClip);
      if (overlayG) {
        if (prevClip) overlayG.setAttribute('clip-path', prevClip);
        else overlayG.removeAttribute('clip-path');
      }
      clipPath.remove();
      if (createdDefs && defs && defs.childNodes.length === 0) defs.remove();
    };
  }, [mapReady]);

  // Draw state boundary + inverse mask to visually clip content outside Nevada
  useEffect(() => {
    if (!stateBoundaryRef.current) return;
    stateBoundaryRef.current.clearLayers();

    // Inverse mask: a world-covering polygon with Nevada boundary as a hole
    // This renders white fill over everything outside Nevada
    const worldOuter: [number, number][] = [
      [-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180],
    ];
    const nevadaHole = nevadaBoundaryGeoJSON.coordinates[0] as [number, number][];
    const maskFeature: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        // GeoJSON: first ring = outer, subsequent rings = holes
        coordinates: [
          worldOuter.map(([lat, lng]) => [lng, lat]),
          nevadaHole,
        ],
      },
    };

    const maskLayer = L.geoJSON(maskFeature as any, {
      pane: PANE_CONFIG.stateMask.id,
      style: {
        color: 'transparent',
        weight: 0,
        fillColor: '#f0f0f0',
        fillOpacity: 0.45,
      },
      interactive: false,
      smoothFactor: 0,
    } as any);
    stateBoundaryRef.current.addLayer(maskLayer);

    // State outline stroke on top
    const geoLayer = createGeoJsonLayer(
      NEVADA_FEATURE,
      MAP_PANES.stateOutline,
      {
        color: 'hsl(240, 5%, 48%)',
        weight: 2.5,
        fillColor: 'transparent',
        fillOpacity: 0,
      },
      false,
    );
    stateBoundaryRef.current.addLayer(geoLayer);
  }, []);

  // County polygons are rendered as invisible hit areas plus separate border strokes.
  // This keeps toggle ownership clean: county toggle controls county-only layers.
  useEffect(() => {
    if (!countyFillRef.current || !countyBorderRef.current) return;
    if (!layers.counties) {
      countyFillRef.current.clearLayers();
      countyBorderRef.current.clearLayers();
      labelsRef.current?.clearLayers();
      return;
    }
    renderCountyPolygons({
      fillGroup: countyFillRef.current,
      borderGroup: countyBorderRef.current,
      labelsGroup: labelsRef.current,
      countyPolygonsPane: MAP_PANES.countyPolygons,
      countyBordersPane: MAP_PANES.countyBorders,
      labelsPane: MAP_PANES.labels,
      getCountyFeature,
      createGeoJsonLayer,
      onHover: (name, event) => updateCountyHoverPreview(name, event),
      onHoverClear: () => clearCountyHoverPreview(),
      onSelect: (name, source, e) => selectCountyEntity(name, source, e),
    });
  }, [clearCountyHoverPreview, layers.counties, selectCountyEntity, updateCountyHoverPreview]);

  useEffect(() => {
    if (!DEBUG_ENABLED || !mapRef.current || !mapReady) return;

    DEBUG_LAYER_DEFINITIONS.forEach((definition) => {
      const group = layerGroups[definition.id as keyof typeof layerGroups];
      if (!group) return;

      const shouldAttach = isLayerEnabledByToggle(definition) && (!debugOpen || isLayerVisibleInDebug(definition));
      if (shouldAttach && !mapRef.current!.hasLayer(group)) {
        group.addTo(mapRef.current!);
      }
      if (!shouldAttach && mapRef.current!.hasLayer(group)) {
        mapRef.current!.removeLayer(group);
      }
    });
  }, [debugOpen, isLayerEnabledByToggle, isLayerVisibleInDebug, layerGroups, mapReady]);

  useEffect(() => {
    if (!highlightsRef.current) return;
    highlightsRef.current.clearLayers();

    renderSelectedCountyHighlight({
      group: highlightsRef.current,
      pane: MAP_PANES.highlights,
      selectedCounty,
      getCountyFeature,
      createGeoJsonLayer,
    });

    if (!layers.fteCapacity || activeFteCoverageIds.length === 0) return;

    renderFteFieldCoverageZones({
      group: highlightsRef.current,
      pane: MAP_PANES.highlights,
      activeFteCoverageIds,
      getCountyFeature,
      createGeoJsonLayer,
    });
  }, [layers.fteCapacity, selectedCounty, selectedFteId, activeFteCoverageIds]);

  useEffect(() => {
    if (!mapRef.current || !selectedCounty) return;

    const selectedCountyFeature = getCountyFeature(selectedCounty);
    if (!selectedCountyFeature) return;

    const focusLayer = L.geoJSON(selectedCountyFeature as any);
    const bounds = focusLayer.getBounds();
    if (!bounds.isValid()) return;

    mapRef.current.fitBounds(bounds, {
      animate: true,
      duration: 0.4,
      padding: [48, 48],
      maxZoom: 8,
    });
  }, [selectedCounty]);

  // Draw zoom-aware decluttered point markers.
  useEffect(() => {
    if (!servicePresenceHaloRef.current || !servicePresenceMarkerRef.current || !behavioralHealthHaloRef.current || !behavioralHealthMarkerRef.current || !markersRef.current || !pointClusterRef.current || !topProviderMarkersRef.current) return;
    servicePresenceHaloRef.current.clearLayers();
    servicePresenceMarkerRef.current.clearLayers();
    behavioralHealthHaloRef.current.clearLayers();
    behavioralHealthMarkerRef.current.clearLayers();
    markersRef.current.clearLayers();
    pointClusterRef.current.clearLayers();
    topProviderMarkersRef.current.clearLayers();
    selectedPointMarkerRef.current = null;

    const shouldRenderProviderLocations = layers.serviceLocations || topProvidersOnly;

    if (!layers.services && !layers.behavioralHealth && !shouldRenderProviderLocations) return;

    const nextFacilityMarkers: L.Layer[] = [];
    const visibleFacilities = shouldRenderProviderLocations ? providerVisibleFacilities : [];
    // When Top 20 is active, force declutter zoom so overlapping providers always fan out
    const effectiveZoom = topProvidersOnly ? Math.max(mapZoom, OVERLAP_DECLUTTER_ZOOM) : mapZoom;
    const displayCoordinates = getDisplayCoordinates([
      ...(layers.services && !topProvidersOnly
        ? filteredCommunityServices.map((service) => ({
            id: `service:${service.id}`,
            lat: service.lat,
            lng: service.lng,
            sortKey: `service:${service.id}`,
          }))
        : []),
      ...(layers.behavioralHealth && !topProvidersOnly
        ? filteredBehavioralHealthServices.map((service) => ({
            id: `behavioral-health:${service.id}`,
            lat: service.lat,
            lng: service.lng,
            sortKey: `behavioral-health:${service.id}`,
          }))
        : []),
      ...visibleFacilities.map((facility) => ({
        id: `facility:${facility.id}`,
        lat: facility.lat,
        lng: facility.lng,
        sortKey: `provider:${facility.type}:${facility.id}`,
      })),
    ], effectiveZoom);

    const applyMarkerPriority = (marker: MapPointMarker, state: 'default' | 'selected') => {
      const baseOffset = marker.__baseZIndexOffset ?? POINT_MARKER_PRIORITY.base;
      const resolvedOffset = state === 'selected'
        ? baseOffset + POINT_MARKER_PRIORITY.selectedBoost
        : baseOffset;

      marker.__priorityState = state;
      marker.setZIndexOffset(resolvedOffset);

      // Toggle visual selected class on DOM element
      const el = marker.getElement?.();
      if (el) {
        if (state === 'selected') {
          el.classList.add('map-pin-selected');
        } else {
          el.classList.remove('map-pin-selected');
        }
      }
    };

    const prioritizeOnSelection = (marker: MapPointMarker) => {
      if (selectedPointMarkerRef.current && selectedPointMarkerRef.current !== marker) {
        applyMarkerPriority(selectedPointMarkerRef.current, 'default');
      }
      selectedPointMarkerRef.current = marker;
      applyMarkerPriority(marker, 'selected');
    };

    selectPointMarkerRef.current = (marker) => {
      if (!marker) return;
      prioritizeOnSelection(marker);
    };

    clearSelectedPointMarkerRef.current = () => {
      if (!selectedPointMarkerRef.current) return;
      applyMarkerPriority(selectedPointMarkerRef.current, 'default');
      selectedPointMarkerRef.current = null;
    };

    if (layers.services && !topProvidersOnly) {
      renderServiceMarkers({
        services: filteredCommunityServices,
        displayCoordinates,
        servicePresencePane: MAP_PANES.servicePresence,
        baseZIndexOffset: POINT_MARKER_PRIORITY.base,
        serviceValidation,
        applyMarkerPriority,
        selectMarkerEntity,
        selectMarkerEntityRef,
        getMemberDistanceInfo,
        markerHoverPreviewRef,
        logMapSelectionDebug,
        cluster: pointClusterRef.current!,
      });
    }

    if (layers.behavioralHealth && !topProvidersOnly) {
      renderBehavioralHealthMarkers({
        services: filteredBehavioralHealthServices,
        displayCoordinates,
        behavioralHealthPane: MAP_PANES.behavioralHealth,
        baseZIndexOffset: POINT_MARKER_PRIORITY.base,
        serviceValidation,
        applyMarkerPriority,
        selectMarkerEntity,
        selectMarkerEntityRef,
        getMemberDistanceInfo,
        markerHoverPreviewRef,
        logMapSelectionDebug,
        cluster: pointClusterRef.current!,
      });
    }

    if (shouldRenderProviderLocations) {
      const providerMarkers = renderProviderMarkers({
        visibleFacilities,
        displayCoordinates,
        mapZoom,
        facilityMarkersPane: MAP_PANES.facilityMarkers,
        baseZIndexOffset: POINT_MARKER_PRIORITY.base,
        showUtilization: layers.utilizationIntensity,
        showTier1Highlight: layers.tier1Highlight,
        topProvidersOnly,
        facilityValidation,
        facilityValidationMode,
        applyMarkerPriority,
        selectMarkerEntity: (entity, source, event, marker) =>
          selectMarkerEntity(entity, source, event ?? undefined, marker),
        getMemberDistanceInfo,
        markerHoverPreviewRef,
        logMapSelectionDebug,
      });
      providerMarkers.forEach((marker) => nextFacilityMarkers.push(marker));
    }

    if (nextFacilityMarkers.length > 0) {
      if (topProvidersOnly) {
        nextFacilityMarkers.forEach((marker) => topProviderMarkersRef.current!.addLayer(marker));
      } else {
        markersRef.current.addLayers(nextFacilityMarkers);
      }
    }


    if (import.meta.env.DEV && shouldRenderProviderLocations && topProvidersOnly) {
      console.info('[Top 20 Debug][Rendered Dataset]', {
        renderedProviderCount: visibleFacilities.length,
        renderedProviderIds: visibleFacilities.map((facility) => facility.id),
        renderedProviderNames: visibleFacilities.map((facility) => facility.name),
      });
    }
  }, [behavioralHealthServicesByCounty, communityServicesByCounty, facilityValidation, facilityValidationMode, filteredBehavioralHealthServices, filteredCommunityServices, layers.behavioralHealth, layers.serviceLocations, layers.services, layers.utilizationIntensity, layers.tier1Highlight, logMapSelectionDebug, mapZoom, onFacilityClick, providerVisibleFacilities, selectMarkerEntity, serviceValidation, topProvidersOnly]);

  // Single shared source-of-truth list of providers contributing to coverage.
  // Used by BOTH the radius renderer and the Access Gaps geometry builder so
  // the visual radii and the gap subtraction can never drift out of sync.
  // Includes only providers from currently-active source layers.
  const activeCoverageProviders = useMemo(() => {
    // Hospitals + clinics are gated SOLELY by the Provider Locations toggle
    // (`layers.serviceLocations`). `topProvidersOnly` only narrows WHICH
    // providers are shown when Provider Locations is on — it cannot revive
    // radii when Provider Locations is off.
    const providerFacilitySource = layers.serviceLocations
      ? (topProvidersOnly ? providerVisibleFacilities : filteredFacilities)
      : [];
    const providerFacilities = providerFacilitySource
      .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng))
      .filter((f) => f.type === 'hospital' || f.type === 'clinic');

    const behavioralHealthProviders = layers.behavioralHealth
      ? ruralServices.filter(
          (s) => isBehavioralHealthService(s)
            && Number.isFinite(s.lat) && Number.isFinite(s.lng),
        )
      : [];

    return [
      ...providerFacilities.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        kind: 'provider' as const,
        facilityType: p.type as 'hospital' | 'clinic',
        source: p,
      })),
      ...behavioralHealthProviders.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        kind: 'behavioralHealth' as const,
        facilityType: 'clinic' as const, // BH styled like clinic radii (blue palette)
        source: p,
      })),
    ];
  }, [
    filteredFacilities,
    providerVisibleFacilities,
    topProvidersOnly,
    layers.serviceLocations,
    layers.behavioralHealth,
    ruralServices,
  ]);

  // Draw coverage radii
  useEffect(() => {
    if (!radiusRef.current) return;
    if (!coverageRadius) {
      radiusRef.current.clearLayers();
      return;
    }
    renderProviderRadii({
      group: radiusRef.current,
      pane: MAP_PANES.driveRadii,
      providers: activeCoverageProviders,
      radiusKm,
      isGap: coverageGaps,
    });
  }, [activeCoverageProviders, coverageRadius, coverageGaps, radiusKm]);

  // Draw coverage gap overlays
  useEffect(() => {
    if (!gapsRef.current) return;
    if (!coverageGaps) {
      gapsRef.current.clearLayers();
      return;
    }

    // Access Gap eligibility uses the SAME shared active provider list as
    // the radius renderer. This guarantees the white "holes" punched out of
    // the red gap polygon always match the visible radii — no stale
    // hospital/clinic subtraction when Provider Locations is off.
    const eligibleProviders = activeCoverageProviders.map((p) => ({ lat: p.lat, lng: p.lng }));

    renderAccessGapOverlay({
      group: gapsRef.current,
      pane: MAP_PANES.gapOverlays,
      activeProviders: eligibleProviders,
      radiusKm,
      onClick: (payload, e) => {
        selectOverlayEntity(payload, 'coverage-gap-overlay', e);
      },
    });
  }, [coverageGaps, activeCoverageProviders, radiusKm, selectOverlayEntity]);

  // ── Grey overlay for non-same-day areas + Operational Coverage Model ──
  useEffect(() => {
    if (!operationalCoverageRef.current || !coverageGreyRef.current || !operationalResponseMarkerRef.current) return;
    operationalCoverageRef.current.clearLayers();
    coverageGreyRef.current.clearLayers();
    operationalResponseMarkerRef.current.clearLayers();

    if (!layers.operationalCoverage || coverageGaps) return;

    const activeZone = activeCoverageZone;
    const inactiveArea = activeZone
      ? difference(featureCollection([NEVADA_FEATURE, activeZone]) as any)
      : NEVADA_FEATURE;

    if (inactiveArea) {
      const greyNonServiceArea = L.geoJSON(inactiveArea as any, {
        pane: MAP_PANES.operationalAreas,
        style: {
          color: 'transparent',
          weight: 0,
          fillColor: 'hsl(220, 10%, 50%)',
          fillOpacity: 0.24,
        },
        interactive: false,
      });
      coverageGreyRef.current.addLayer(greyNonServiceArea);
    }

    if (!activeZone) return;

    // Active service geometry renders directly with clipped county/state layers beneath it.
    const activeFill = L.geoJSON(activeZone, {
      pane: MAP_PANES.operationalAreas,
      style: {
        color: 'hsla(174, 50%, 40%, 0.35)',
        weight: 1.5,
        fillColor: 'hsla(174, 50%, 45%, 0.16)',
        fillOpacity: 1,
      },
      interactive: false,
    });
    operationalCoverageRef.current.addLayer(activeFill);

    const activeOutline = L.geoJSON(activeZone, {
      pane: MAP_PANES.operationalAreas,
      style: {
        color: 'hsla(174, 50%, 40%, 0.55)',
        weight: 2,
        fillColor: 'transparent',
        fillOpacity: 0,
      },
      interactive: false,
    });
    operationalCoverageRef.current.addLayer(activeOutline);

    nevadaCounties.forEach((county) => {
      const breakdown = getCountyCoverageBreakdown(county.name, coverageRadiusKm);
      const category = getResponseCapabilityCategory(breakdown);
      const markerSize = RESPONSE_CAPABILITY_META[category].markerSize;
      const buildIcon = (hovered = false) => L.divIcon({
        className: '',
        html: getResponseCapabilityMarkerHtml(category, hovered),
        iconSize: [markerSize + (hovered ? 2 : 0), markerSize + (hovered ? 2 : 0)],
        iconAnchor: [markerSize / 2, 4],
        tooltipAnchor: [0, -(markerSize + 4)],
      });

      // Remote-only counties anchor the pin just outside the nearest active
      // FTE coverage radius (in the bearing of the county centroid) so the
      // marker reads as "support originates here", not "support sits inside
      // an unreachable county". Active/scheduled counties keep the centroid
      // placement — the field reach genuinely covers them.
      const markerLatLng: [number, number] =
        category === 'remote'
          ? getRemoteSupportMarkerLatLng(county.center, coverageRadiusKm)
          : category === 'active'
            ? getActiveFieldMarkerLatLng(county.center, coverageRadiusKm)
            : county.center;

      const marker = L.marker(markerLatLng, {
        icon: buildIcon(selectedCounty === county.name),
        interactive: true,
        pane: MAP_PANES.responseCapabilityMarkers,
        zIndexOffset: category === 'active' ? 820 : category === 'scheduled' ? 780 : 740,
      });

      marker.on('mouseover', () => {
        marker.setIcon(buildIcon(true));
        updateCountyHoverPreview(county.name);
        const drive = getDriveEstimate(county.center, category);
        markerHoverPreviewRef.current({
          name: county.name,
          subtitle: RESPONSE_CAPABILITY_META[category].label,
          detail: RESPONSE_CAPABILITY_META[category].description,
          driveEstimate: drive?.line,
        });
      });
      marker.on('mouseout', () => {
        marker.setIcon(buildIcon(selectedCounty === county.name));
        clearCountyHoverPreview();
        markerHoverPreviewRef.current(null);
      });

      marker.on('click', (event: L.LeafletEvent) => {
        selectCountyEntity(county.name, 'response-capability-marker', event);
      });

      operationalResponseMarkerRef.current!.addLayer(marker);
    });
  }, [activeCoverageZone, clearCountyHoverPreview, coverageGaps, coverageRadiusKm, layers.operationalCoverage, selectCountyEntity, selectedCounty, updateCountyHoverPreview]);

  // ── FTE Capacity hub indicators ──
  useEffect(() => {
    if (!fteCapacityRef.current) return;
    if (!layers.fteCapacity || topProvidersOnly) {
      fteCapacityRef.current.clearLayers();
      return;
    }

    renderFteHubs({
      group: fteCapacityRef.current,
      pane: PANE_CONFIG.fteLabels.id,
      selectedFteId,
      onClick: (fteId, e) => {
        stopInteractionEvent(e);
        armInteractionGuard('overlay');
        clearSelectedPointMarkerRef.current();
        onFteHubClickRef.current?.(fteId);
      },
    });
  }, [armInteractionGuard, layers.fteCapacity, selectedFteId, stopInteractionEvent]);

  // ── Utilization Intensity choropleth (purple ramp) ──
  useEffect(() => {
    if (!utilizationRef.current) return;
    if (!layers.utilizationIntensity || coverageGaps) {
      utilizationRef.current.clearLayers();
      return;
    }
    renderUtilizationChoropleth({
      group: utilizationRef.current,
      pane: MAP_PANES.countyPolygons,
      getCountyFeature,
      onCountyClick: (payload, e) => {
        selectOverlayEntity(payload, 'utilization-county', e);
      },
    });
  }, [clearCountyHoverPreview, coverageGaps, layers.utilizationIntensity, selectOverlayEntity, updateCountyHoverPreview]);

  // ── Engagement Gap priority heat-style intensity layer ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous heat layer
    if (engagementHeatRef.current) {
      map.removeLayer(engagementHeatRef.current);
      engagementHeatRef.current = null;
    }
    // Remove dim overlay
    const existingDim = document.getElementById('priority-dim-overlay');
    if (existingDim) existingDim.remove();

    if (!layers.engagementGap || engagementGapView !== 'priority') return;

    // Filter eligible counties
    const eligible = engagementPriorityCounties.filter(
      (m) => !(m.totalMembers > 0 && m.engagementRate > 0.80)
    );
    if (eligible.length === 0) return;

    // Build heat points from county centroids using composite priority score
    const heatPoints: [number, number, number][] = [];

    eligible.forEach((metrics) => {
      const geoJson = getCountyFeature(metrics.county);
      if (!geoJson) return;

      // Get centroid
      const center = centroid(geoJson as Feature<Polygon | MultiPolygon>);
      const [lng, lat] = center.geometry.coordinates;

      // Composite score: blends unengaged count, engagement rate, and staff coverage
      const compositeScore = getCompositeEngagementPriority(metrics.county);
      // Bottom 15% get zero weight (invisible)
      if (compositeScore < 0.15) return;
      const weight = Math.pow(compositeScore, 0.45);

      // Primary centroid point
      heatPoints.push([lat, lng, weight]);

      // Spread 4 secondary points around centroid for coverage
      const spread = 0.12; // ~12km offset
      const secondaryWeight = weight * 0.6;
      heatPoints.push([lat + spread, lng, secondaryWeight]);
      heatPoints.push([lat - spread, lng, secondaryWeight]);
      heatPoints.push([lat, lng + spread, secondaryWeight]);
      heatPoints.push([lat, lng - spread, secondaryWeight]);
    });

    if (heatPoints.length === 0) return;

    // Create heat layer
    const heat = (L as any).heatLayer(heatPoints, {
      radius: 50,
      blur: 25,
      maxZoom: 12,
      max: 0.6,
      minOpacity: 0.35,
      gradient: {
        0.0: 'transparent',
        0.15: '#FFF3E0',
        0.3: '#FFB74D',
        0.45: '#F57C00',
        0.6: '#E64A19',
        0.75: '#D32F2F',
        0.9: '#B71C1C',
        1.0: '#880E4F',
      },
    });

    heat.addTo(map);
    engagementHeatRef.current = heat;

    // Ensure heat layer renders below markers by moving its canvas
    const heatPane = map.getPane('overlayPane');
    if (heatPane) {
      heatPane.style.zIndex = '250';
    }

    // Add subtle dim overlay to basemap
    const mapContainer = map.getContainer();
    const dimOverlay = document.createElement('div');
    dimOverlay.id = 'priority-dim-overlay';
    dimOverlay.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.07);
      z-index: 199;
      pointer-events: none;
    `;
    mapContainer.appendChild(dimOverlay);

  }, [engagementGapView, engagementPriorityCounties, layers.engagementGap]);

  // ── Engagement Gap county outlines (orange = gap, yellow = watchlist) — boundaries view ──
  useEffect(() => {
    if (!engagementGapRef.current) return;
    engagementGapRef.current.clearLayers();
    engagementGapLabelRef.current?.clearLayers();
    if (!layers.engagementGap || engagementGapView !== 'boundaries') return;

    const results = getEngagementGapResults();
    const priorityColor = 'hsl(var(--destructive))';

    engagementPriorityCounties.forEach((metrics) => {
      const geoJson = getCountyFeature(metrics.county);
      if (!geoJson) return;

      const normalizedPriority = maxPriorityUnengagedMembers > 0
        ? metrics.unengagedMembers / maxPriorityUnengagedMembers
        : 0;
      const fillOpacity = metrics.isTop5Unengaged
        ? 0.18 + normalizedPriority * 0.22
        : 0.06 + normalizedPriority * 0.12;
      const strokeOpacity = metrics.isTop5Unengaged ? 0.95 : 0.55;
      const weight = metrics.isTop5Unengaged ? 2 : 1;

      const geoLayer = L.geoJSON(geoJson, {
        pane: MAP_PANES.gapOverlays,
        style: {
          color: priorityColor,
          opacity: strokeOpacity,
          weight,
          fillColor: priorityColor,
          fillOpacity,
        },
        interactive: true,
      });

      geoLayer.on('mouseover', (event: L.LeafletMouseEvent) => {
        updateCountyHoverPreview(metrics.county, event);
        geoLayer.setStyle({ fillOpacity: Math.min(fillOpacity + 0.06, 0.5), weight: weight + 0.5 });
      });
      geoLayer.on('mouseout', () => {
        clearCountyHoverPreview();
        geoLayer.setStyle({ fillOpacity, weight });
      });
      geoLayer.on('click', (event: L.LeafletEvent) => {
        selectCountyEntity(metrics.county, 'engagement-gap-priority-county', event);
      });

      engagementGapRef.current!.addLayer(geoLayer);
    });

    const TIER_STYLES: Record<string, { color: string; fill: string; fillOpacity: number; weight: number; dash: string; icon: string; title: string }> = {
      gap:            { color: 'hsl(30, 90%, 50%)',  fill: 'transparent',            fillOpacity: 0,    weight: 2.5, dash: '6 3', icon: '⚠', title: 'Engagement Gap: High utilization, no field support' },
      watchlist:      { color: 'hsl(48, 90%, 50%)',  fill: 'hsla(48, 90%, 50%, 0.08)', fillOpacity: 0.08, weight: 2.5, dash: '4 4', icon: '⚡', title: 'Watchlist: Moderate utilization, no field support' },
      'early-signal': { color: 'hsl(200, 70%, 55%)', fill: 'hsla(200, 70%, 55%, 0.06)', fillOpacity: 0.06, weight: 1.5, dash: '3 3', icon: '◈', title: 'Early Signal: Emerging utilization, no field support' },
    };

    results.forEach((result: EngagementGapResult) => {
      const county = nevadaCounties.find(c => c.name === result.county);
      if (!county) return;

      let geoJson: any;

      if (result.subZone === 'northern-washoe') {
        const merged = getCountyFeature(county.name);
        if (!merged) return;
        const clipNorth = {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [[
              [-120.5, WASHOE_URBAN_RURAL_LAT],
              [-119.0, WASHOE_URBAN_RURAL_LAT],
              [-119.0, 42.1],
              [-120.5, 42.1],
              [-120.5, WASHOE_URBAN_RURAL_LAT],
            ]],
          },
        };
        geoJson = clipPolygon(merged, clipNorth as any);
      } else {
        geoJson = getCountyFeature(county.name);
      }
      if (!geoJson) return;

      const s = TIER_STYLES[result.tier];
      const geoLayer = L.geoJSON(geoJson, {
        pane: MAP_PANES.gapOverlays,
        style: {
          color: s.color,
          weight: s.weight,
          fillColor: s.fill,
          fillOpacity: s.fillOpacity,
          dashArray: s.dash,
        },
        interactive: true,
      });
      geoLayer.on('mouseover', (event: L.LeafletMouseEvent) => updateCountyHoverPreview(result.county, event));
      
      geoLayer.on('mouseout', () => clearCountyHoverPreview());
      geoLayer.on('click', (event: L.LeafletEvent) => {
        selectCountyEntity(result.county, 'engagement-gap-county', event);
      });
      engagementGapRef.current!.addLayer(geoLayer);

      // Icon at county center (or offset north for Northern Washoe)
      const iconCenter: [number, number] = result.subZone === 'northern-washoe'
        ? [40.8, -119.7]  // center of northern Washoe zone
        : county.center;
      const warnIcon = L.divIcon({
        className: '',
        html: `<div style="font-size:${result.tier === 'early-signal' ? '11' : '14'}px;text-shadow:0 0 3px white,0 0 3px white;" title="${s.title}">${s.icon}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(iconCenter, { icon: warnIcon, interactive: false, pane: MAP_PANES.labels }).addTo(engagementGapLabelRef.current!);
    });
  }, [clearCountyHoverPreview, engagementGapView, engagementPriorityCounties, layers.engagementGap, maxPriorityUnengagedMembers, selectCountyEntity, updateCountyHoverPreview]);

  // ── Tribal Nations polygons (real GeoJSON boundaries) ──
  useEffect(() => {
    if (!tribalNationsRef.current || !mapRef.current) return;
    tribalNationsRef.current.clearLayers();
    if (!layers.tribalNations) return;

    tribalNations.forEach((tribe) => {
      if (!tribe.geometry) return;

      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { tribeId: tribe.id },
        geometry: tribe.geometry,
      };

      const layer = L.geoJSON(feature as any, {
        pane: MAP_PANES.tribalNations,
        style: {
          color: 'hsl(30, 65%, 45%)',
          weight: 1.5,
          fillColor: 'hsla(30, 65%, 50%, 0.12)',
          fillOpacity: 1,
          interactive: true,
        },
        interactive: true,
        bubblingMouseEvents: false,
        onEachFeature: (_feat, lyr) => {
          // Ensure pointer-events on the SVG paths
          lyr.on('add', () => {
            const el = (lyr as any)._path as HTMLElement | undefined;
            if (el) {
              el.style.pointerEvents = 'auto';
              el.style.outline = 'none';
              el.setAttribute('tabindex', '-1');
            }
          });

          lyr.on('mouseover', () => {
            markerHoverPreviewRef.current({ name: tribe.name });
          });
          lyr.on('mouseout', () => markerHoverPreviewRef.current(null));

          lyr.on('click', (event: L.LeafletEvent) => {
            L.DomEvent.stopPropagation(event as any);
            armInteractionGuard('marker');
            onEntityClick?.({ type: 'tribalNation', tribe });
          });
        },
      } as any);

      tribalNationsRef.current!.addLayer(layer);
    });
  }, [layers.tribalNations, onEntityClick, tribalBoundariesReady]);

  // ── Broadband Access choropleth ──
  useEffect(() => {
    if (!broadbandRef.current) return;
    broadbandRef.current.clearLayers();
    if (!layers.broadbandAccess) return;

    const STATUS_FILL: Record<BroadbandStatus, string> = {
      Served: 'hsla(160, 50%, 45%, 0.14)',
      Underserved: 'hsla(38, 85%, 52%, 0.16)',
      Unserved: 'hsla(0, 65%, 55%, 0.16)',
    };

    nevadaCounties.forEach((county) => {
      const bb = BROADBAND_BY_COUNTY.get(county.name);
      if (!bb) return;
      const feature = getCountyFeature(county.name);
      if (!feature) return;

      const geoLayer = L.geoJSON(feature, {
        pane: MAP_PANES.broadbandOverlay,
        style: {
          color: 'transparent',
          weight: 0,
          fillColor: STATUS_FILL[bb.broadbandStatus],
          fillOpacity: 1,
        },
        interactive: false,
      });
      broadbandRef.current!.addLayer(geoLayer);
    });
  }, [layers.broadbandAccess, broadbandReady]);

  // ── Cellular Coverage choropleth ──
  useEffect(() => {
    if (!cellularRef.current) return;
    cellularRef.current.clearLayers();
    if (!layers.cellularCoverage) return;

    const READINESS_FILL: Record<import('@/data/cellular-coverage').OperationalCellularReadiness, string> = {
      High: 'hsla(160, 55%, 40%, 0.14)',
      Mixed: 'hsla(44, 90%, 50%, 0.16)',
      Low: 'hsla(20, 85%, 55%, 0.16)',
    };

    nevadaCounties.forEach((county) => {
      const cell = CELLULAR_BY_COUNTY.get(county.name);
      if (!cell) return;
      const feature = getCountyFeature(county.name);
      if (!feature) return;

      const geoLayer = L.geoJSON(feature, {
        pane: MAP_PANES.cellularOverlay,
        style: {
          color: 'transparent',
          weight: 0,
          fillColor: READINESS_FILL[cell.operationalCellularReadiness],
          fillOpacity: 1,
        },
        interactive: false,
      });
      cellularRef.current!.addLayer(geoLayer);
    });
  }, [layers.cellularCoverage]);

  // ── Member pin + radius rings ──
  // Tracks the last memberLocation we auto-fit to, so we only fit on first
  // placement or when the underlying address changes (geocode result).
  // Drag-end re-renders the pin in place but must NOT re-fit/re-zoom the
  // map — that reads as the pin "jumping" mid-interaction.
  const lastFittedMemberKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !memberPinRef.current || !memberRingsRef.current) return;
    memberPinRef.current.clearLayers();
    memberRingsRef.current.clearLayers();
    if (!memberLocation) {
      lastFittedMemberKeyRef.current = null;
      return;
    }

    const { lat, lng } = memberLocation;
    const map = mapRef.current;

    // Member pin — highest z, draggable. Marker construction extracted to
    // ./layers/MemberPinLayer for containment; behavior unchanged.
    const marker = createMemberPinMarker(lat, lng, PANE_CONFIG.memberPin.id, (coords) => {
      onMemberPlaceRef.current?.(coords);
    });
    memberPinRef.current.addLayer(marker);

    // Radius rings: 10mi, 25mi, 40mi — extracted to ./layers/MemberRadiusRingsLayer.
    const milesToMeters = (mi: number) => mi * 1609.344;
    addMemberRadiusRings(memberRingsRef.current!, lat, lng, PANE_CONFIG.memberRings.id);

    // Auto-focus map to show 25mi ring on first placement or new address.
    // Drag updates keep the current viewport.
    const fitKey = memberLocation.address
      ? `addr:${memberLocation.address}`
      : `coord:${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (map && lastFittedMemberKeyRef.current !== fitKey) {
      const metersFor25mi = milesToMeters(25);
      const bounds = L.latLng(lat, lng).toBounds(metersFor25mi * 2);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
      lastFittedMemberKeyRef.current = fitKey;
    }

  }, [mapReady, memberLocation]);

  // ── Rail Corridor overlay (additive transport layer) ──
  // STRICTLY ADDITIVE: does not affect any other layer, filter, score, or queue.
  useEffect(() => {
    if (!mapReady || !railLayerRef.current) return;
    railLayerRef.current.clearLayers();
    if (!layers.railCorridor) {
      if (import.meta.env.DEV) {
        console.info('[Rail] toggle=OFF; overlay cleared');
      }
      return;
    }

    railCorridors.forEach((corridor) => {
      if (!corridor.active) return;
      const polyline = L.polyline(corridor.coordinates, {
        pane: PANE_CONFIG.coverage.id,
        color: 'hsl(0, 0%, 35%)',
        weight: 1.6,
        opacity: 0.7,
        dashArray: '6 4',
        interactive: false,
        smoothFactor: 0,
      });
      polyline.bindTooltip(`${corridor.name} · ${corridor.frequencyNote}`, {
        sticky: true,
        opacity: 0.9,
        className: 'rail-corridor-tooltip',
      });
      railLayerRef.current!.addLayer(polyline);
    });

    const stationIcon = L.divIcon({
      className: '',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      html: `<div style="width:12px;height:12px;border-radius:2px;background:hsl(0,0%,98%);border:1.5px solid hsl(0,0%,30%);box-shadow:0 1px 2px rgba(0,0,0,0.15);"></div>`,
    });

    railStations.forEach((station) => {
      if (!station.active) return;
      const marker = L.marker([station.lat, station.lng], {
        icon: stationIcon,
        pane: PANE_CONFIG.markers.id,
        interactive: true,
        keyboard: false,
        zIndexOffset: -500,
      });
      marker.bindTooltip(station.name, {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.95,
        className: 'rail-station-tooltip',
      });
      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        armInteractionGuard('marker');
        onEntityClickRef.current?.({ type: 'railStation', station });
      });
      railLayerRef.current!.addLayer(marker);
    });

    if (import.meta.env.DEV) {
      console.info('[Rail] overlay loaded', {
        toggle: 'ON',
        corridors: railCorridors.filter(c => c.active).length,
        stations: railStations.filter(s => s.active).length,
        memberActive: !!memberLocation,
      });
    }
  }, [mapReady, layers.railCorridor, memberLocation]);


  // ── Local Transit Zones overlay (additive access-support layer) ──
  // STRICTLY ADDITIVE: does not affect any other layer, filter, score, or queue.
  useEffect(() => {
    if (!mapReady || !localTransitLayerRef.current) return;
    localTransitLayerRef.current.clearLayers();
    if (!layers.localTransitZones) {
      if (import.meta.env.DEV) {
        console.info('[LocalTransit] toggle=OFF; overlay cleared');
      }
      return;
    }

    localTransitZones.forEach((zone) => {
      if (!zone.active) return;
      const provider = getProviderForZoneId(zone.id);
      const isSelected = !!provider && provider.id === selectedTransitProviderId;
      const polygon = L.polygon(zone.geometry, {
        // Use the markers pane (z650) so polygons are interactive but sit
        // BELOW providerMarkers (z660). Pin clicks always win at overlap.
        pane: PANE_CONFIG.markers.id,
        color: 'hsl(210, 70%, 50%)',
        weight: isSelected ? 2.4 : 1.2,
        opacity: isSelected ? 1 : 0.7,
        dashArray: isSelected ? undefined : '4 4',
        fillColor: 'hsl(205, 85%, 70%)',
        fillOpacity: isSelected ? 0.22 : 0.1,
        interactive: true,
        bubblingMouseEvents: false,
        className: isSelected ? 'local-transit-zone selected' : 'local-transit-zone',
      });
      const tooltipLabel = provider
        ? `${zone.name} · ${provider.name}`
        : `${zone.name} · approximate footprint`;
      polygon.bindTooltip(tooltipLabel, {
        sticky: true,
        opacity: 0.9,
        className: 'rail-corridor-tooltip',
      });
      polygon.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        // Strict explicit mapping: zone.id → provider via getProviderForZoneId.
        // No proximity, no fallback. If a zone has no provider, do nothing.
        const matched = getProviderForZoneId(zone.id);
        if (!matched) {
          if (import.meta.env.DEV) {
            console.warn('[LocalTransit] click on zone with no mapped provider', { zoneId: zone.id });
          }
          return;
        }
        if (import.meta.env.DEV) {
          console.info('[LocalTransit] zone click → provider', {
            zoneId: zone.id,
            providerId: matched.id,
            providerName: matched.name,
          });
        }
        onEntityClickRef.current?.({ type: 'localTransitProvider', provider: matched });
      });
      localTransitLayerRef.current!.addLayer(polygon);
    });

    if (import.meta.env.DEV) {
      const activeCount = localTransitZones.filter(z => z.active).length;
      console.info('[LocalTransit] overlay loaded', {
        toggle: 'ON',
        zones: activeCount,
        selectedProviderId: selectedTransitProviderId,
      });
    }
  }, [mapReady, layers.localTransitZones, selectedTransitProviderId]);

  // Additive: fit map to externally requested bounds (e.g., transit provider click).
  useEffect(() => {
    if (!mapReady || !mapRef.current || !focusBounds) return;
    const [[s, w], [n, e]] = focusBounds;
    const bounds = L.latLngBounds([s, w], [n, e]);
    if (!bounds.isValid()) return;
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 11, animate: true, duration: 0.4 });
  }, [mapReady, focusBounds]);


  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MemberAccessSearch
        onSearch={(addr) => onMemberGeocode?.(addr)}
        onClear={() => onMemberClear?.()}
        isGeocoding={memberIsGeocoding}
        error={memberGeocodeError}
        hasPin={!!memberLocation}
      />
      {presentationIsPresenting && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 z-[820] rounded-full border border-border/60 bg-card/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur-sm"
        >
          Presentation Mode
        </div>
      )}
      <HoverPreviewLayer
        countyHoverPreview={countyHoverPreview}
        markerHoverPreview={markerHoverPreview}
        layers={layers}
        isPublicSafe={isPublicSafe}
      />
      {(layers.broadbandAccess || layers.cellularCoverage) && !decisionAssistOpen && (
        // Legend is hidden while the Decision Assist drawer is expanded so it
        // does not visually float above the drawer body. It returns to its
        // anchored bottom-left position as soon as the drawer collapses.
        <div className="absolute bottom-4 left-4 z-[800] rounded-md border border-border bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur-sm space-y-2">
          {layers.broadbandAccess && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Broadband Access</p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(160, 50%, 45%, 0.35)' }} />
                  <span className="text-foreground/80">Served</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(38, 85%, 52%, 0.35)' }} />
                  <span className="text-foreground/80">Underserved</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(0, 65%, 55%, 0.35)' }} />
                  <span className="text-foreground/80">Unserved</span>
                </div>
              </div>
            </div>
          )}
          {layers.broadbandAccess && layers.cellularCoverage && (
            <div className="border-t border-border/50" />
          )}
          {layers.cellularCoverage && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Cellular Readiness</p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(160, 55%, 40%, 0.35)' }} />
                  <span className="text-foreground/80">High</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(44, 90%, 50%, 0.35)' }} />
                  <span className="text-foreground/80">Mixed</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(20, 85%, 55%, 0.35)' }} />
                  <span className="text-foreground/80">Low</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground/50 mt-1">FCC BDC J25 · Confidence: Medium</p>
              <p className="text-[8px] text-muted-foreground/40 mt-0.5 leading-snug">Geographic availability, not signal quality. Rural counties may appear lower despite coverage in towns.</p>
            </div>
          )}
        </div>
      )}
      {DEBUG_ENABLED && (
        <MapDebugPanel
          open={debugOpen}
          layers={debugLayers}
          warnings={geometryWarnings.warnings}
          isolatedLayerId={isolatedLayerId}
          isolatedGroup={isolatedGroup}
          facilityValidationEnabled={facilityValidationMode}
          facilityValidationSummary={facilityValidation.summary}
          onToggleLayer={toggleDebugLayer}
          onIsolateLayer={isolateDebugLayer}
          onIsolateGroup={isolateDebugGroup}
          onClearIsolation={clearDebugIsolation}
          onToggleFacilityValidation={() => setFacilityValidationMode((current) => !current)}
        />
      )}
    </div>
  );
};

export default MapView;
