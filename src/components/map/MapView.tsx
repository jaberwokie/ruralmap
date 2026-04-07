import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debugMarkerClick, debugCountyClick, debugMapClear } from '@/components/map/debugClickOverlay';
import { useBroadbandData } from '@/hooks/useBroadbandData';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { Info } from 'lucide-react';
import { Facility, getFacilityClassification, getFacilityDataConfidence, getFacilityTypeLabel } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { ruralServices } from '@/data/rural-services';
import { isBehavioralHealthService, isCommunitySupportService } from '@/utils/ruralServiceClassification';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import { MapEntity } from '@/types/entities';
import { getActiveCoverageZone, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { fteCapacityData, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { getCountyUtilization, getUtilizationTier, UTILIZATION_COLORS, getFacilityUtilization, getScaledPinSize, getProviderUtilizationScore, getEngagementGapCounties, getEngagementGapResults, EngagementGapResult, WASHOE_URBAN_RURAL_LAT, getFilteredEngagementPriorityCounties, getCountyEngagementMetrics } from '@/utils/utilizationAggregation';
import { BROADBAND_BY_COUNTY, type BroadbandStatus } from '@/data/broadband-coverage';
import { CELLULAR_BY_COUNTY, formatCarriers, type CellularReliability } from '@/data/cellular-coverage';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MAP_PIN_VISUALS, getSharedPinSvgMarkup } from '@/components/map/pinVisuals';
import { RESPONSE_CAPABILITY_META, getResponseCapabilityCategory, getResponseCapabilityMarkerHtml } from '@/components/map/responseCapabilityVisuals';
import { getProviderAccessTierByKm } from '@/utils/providerAccessTiers';
import { getProviderClaimsMetrics } from '@/utils/providerClaimsMetrics';

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
  };
  typeFilters?: Set<string>;
  countyFilters?: Set<string>;
  serviceCategoryFilters?: Set<string>;
  onFacilityClick: (facility: Facility) => void;
  onMapClick?: () => void;
  searchQuery: string;
  radiusKm: number;
  coverageRadius: boolean;
  coverageGaps: boolean;
  onEntityClick?: (entity: MapEntity | null) => void;
  onEntityHover?: (entity: MapEntity | null) => void;
  selectedCounty?: string | null;
  onFteHubClick?: (fteId: string) => void;
  selectedFteId?: string | null;
  coverageRadiusKm?: number;
  topProvidersOnly?: boolean;
  engagementRateBelow20Only?: boolean;
  tutorialStepKey?: string | null;
}

interface CountyHoverMetrics {
  county: string;
  totalMembers?: number;
  unengagedMembers?: number;
  providerCount?: number;
  serviceCount?: number;
  coverageGapPercent?: number;
  broadbandStatus?: BroadbandStatus;
  broadbandServedPercent?: number;
  broadbandUnservedPercent?: number;
  cellularReliability?: CellularReliability;
  cellularCarriers?: string;
}

interface CountyHoverPreview extends CountyHoverMetrics {
  x: number;
  y: number;
}

type CoverageGapSeverity = 'High' | 'Moderate' | 'Low';

// Haversine distance in km
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const RADIUS_COLORS = { stroke: 'hsla(200, 50%, 50%, 0.6)', fill: 'hsla(200, 50%, 50%, 0.10)' };

// ═══════════════════════════════════════════════════════════
// AUTHORITATIVE PANE CONFIGURATION — single source of truth
// interactive: true  → pointer-events: auto  (receives clicks)
// interactive: false → pointer-events: none  (decorative only)
// ═══════════════════════════════════════════════════════════
const PANE_CONFIG = {
  stateOutline:              { id: 'state-outline-pane',              zIndex: 320, interactive: false },
  countyPolygons:            { id: 'county-polygons-pane',            zIndex: 330, interactive: true  },
  broadbandOverlay:          { id: 'broadband-overlay-pane',          zIndex: 335, interactive: false },
  cellularOverlay:           { id: 'cellular-overlay-pane',           zIndex: 336, interactive: false },
  countyBorders:             { id: 'county-borders-pane',             zIndex: 340, interactive: false },
  operationalAreas:          { id: 'operational-areas-pane',          zIndex: 350, interactive: false },
  driveRadii:                { id: 'drive-radii-pane',                zIndex: 360, interactive: false },
  gapOverlays:               { id: 'gap-overlays-pane',               zIndex: 370, interactive: true  },
  groupedMarkers:            { id: 'grouped-markers-pane',            zIndex: 705, interactive: true  },
  servicePresence:           { id: 'service-presence-pane',           zIndex: 710, interactive: true  },
  behavioralHealth:          { id: 'behavioral-health-pane',          zIndex: 711, interactive: true  },
  responseCapabilityMarkers: { id: 'response-capability-markers-pane',zIndex: 715, interactive: true  },
  facilityMarkers:           { id: 'facility-markers-pane',           zIndex: 720, interactive: true  },
  labels:                    { id: 'labels-pane',                     zIndex: 730, interactive: false },
  highlights:                { id: 'highlights-pane',                 zIndex: 740, interactive: false },
} as const;

// Derived lookup maps for backward-compat with existing layer code
const MAP_PANES = Object.fromEntries(
  Object.entries(PANE_CONFIG).map(([k, v]) => [k, v.id])
) as { [K in keyof typeof PANE_CONFIG]: (typeof PANE_CONFIG)[K]['id'] };

// Centralized pane initializer — called once during map setup
function initializeAllPanes(map: L.Map) {
  Object.entries(PANE_CONFIG).forEach(([key, cfg]) => {
    const pane = map.createPane(cfg.id);
    pane.style.zIndex = String(cfg.zIndex);
    // ALL pane divs are pointer-events: none. Interactive elements (marker
    // icons via .leaflet-marker-icon and SVG paths via .leaflet-interactive)
    // opt in at the element level. This prevents higher-z pane divs from
    // blocking clicks on markers/polygons in lower-z panes.
    pane.style.pointerEvents = 'none';
    if (import.meta.env.DEV) {
      pane.addEventListener('click', () => {
        console.debug('[Pane Click]', { pane: key, id: cfg.id, interactive: cfg.interactive });
      }, true);
    }
  });
}

const LEAFLET_UI_PANE_Z_INDEX = {
  markerPane: 700,
  tooltipPane: 820,
  popupPane: 830,
} as const;

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
const DEBUG_ENABLED = import.meta.env.DEV;

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
  pane: (typeof MAP_PANES)[keyof typeof MAP_PANES],
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
  __priorityState?: 'default' | 'hovered' | 'selected';
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

const SELECTION_GUARD_MS = 220;

const getEntityDebugMeta = (entity: MapEntity | null | undefined) => {
  if (!entity) {
    return { entityType: null, entityId: null, entityName: null };
  }

  switch (entity.type) {
    case 'facility':
      return { entityType: entity.type, entityId: entity.facility.id, entityName: entity.facility.name };
    case 'ruralService':
      return { entityType: entity.type, entityId: entity.service.id, entityName: entity.service.name };
    case 'county':
      return { entityType: entity.type, entityId: entity.county, entityName: entity.county };
    case 'memberVolume':
      return { entityType: entity.type, entityId: entity.county, entityName: entity.county };
    case 'coverageGap':
      return { entityType: entity.type, entityId: String(entity.radiusKm), entityName: `Coverage Gap ${entity.radiusKm}km` };
    case 'coverageArea':
      return { entityType: entity.type, entityId: entity.area, entityName: entity.area };
    case 'ruralServiceGroup':
      return { entityType: entity.type, entityId: entity.county, entityName: entity.county };
    case 'fteDetail':
      return { entityType: entity.type, entityId: entity.fteId, entityName: entity.fteId };
    default:
      return { entityType: null, entityId: null, entityName: null };
  }
};

const getDeclutterRadiusByZoom = (zoom: number) => {
  if (zoom <= 7) return 26;
  if (zoom === 8) return 22;
  if (zoom === 9) return 18;
  if (zoom === 10) return 14;
  if (zoom === 11) return 10;
  return 6;
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

const numberFormatter = new Intl.NumberFormat();

const getCountyDisplayName = (county: string) => county === 'Carson City' ? county : `${county} County`;

const CountyHoverMetricRow = ({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-[10px] leading-4">
    <span className="truncate text-muted-foreground">{label}</span>
    <span className={`text-right font-medium tabular-nums ${emphasize ? 'text-foreground' : 'text-foreground/85'}`}>{value}</span>
  </div>
);

const getCoverageGapSeverity = (coverageGapPercent: number): CoverageGapSeverity => {
  if (coverageGapPercent > 60) return 'High';
  if (coverageGapPercent >= 30) return 'Moderate';
  return 'Low';
};

const CoverageGapInfoButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          aria-label="Explain coverage gap"
        >
          <Info className="h-2.5 w-2.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={8} className="max-w-52 text-[10px] leading-4">
        Percent of county area outside provider coverage radius based on current radius setting.
      </TooltipContent>
    </Tooltip>
  );
};


const MapView = ({ facilities, allFacilities, layers, typeFilters, countyFilters, serviceCategoryFilters, onFacilityClick, onMapClick, searchQuery, radiusKm, coverageRadius, coverageGaps, onEntityClick, onEntityHover, selectedCounty, onFteHubClick, selectedFteId, coverageRadiusKm = 120, topProvidersOnly = false, engagementRateBelow20Only = false }: MapViewProps) => {
  const { broadbandReady } = useBroadbandData();
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
  const engagementGapLabelRef = useRef<L.LayerGroup | null>(null);
  const highlightsRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(7);
  const [debugOpen, setDebugOpen] = useState(false);
  const [facilityValidationMode, setFacilityValidationMode] = useState(false);
  const [countyHoverPreview, setCountyHoverPreview] = useState<CountyHoverPreview | null>(null);
  const [layerVisibilityOverrides, setLayerVisibilityOverrides] = useState<Record<string, boolean>>({});
  const [isolatedLayerId, setIsolatedLayerId] = useState<string | null>(null);
  const [isolatedGroup, setIsolatedGroup] = useState<DebugIsolationGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onEntityClickRef = useRef(onEntityClick);
  onEntityClickRef.current = onEntityClick;
  const onEntityHoverRef = useRef(onEntityHover);
  onEntityHoverRef.current = onEntityHover;
  const onFteHubClickRef = useRef(onFteHubClick);
  onFteHubClickRef.current = onFteHubClick;
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

  const stopInteractionEvent = useCallback((event?: L.LeafletEvent | Event | null) => {
    if (!event) return;
    const originalEvent = (event as L.LeafletEvent & { originalEvent?: Event }).originalEvent;
    if (originalEvent) {
      L.DomEvent.stop(originalEvent as any);
      return;
    }
    L.DomEvent.stop(event as any);
  }, []);

  const armInteractionGuard = useCallback((source: 'marker' | 'county' | 'overlay') => {
    const expiresAt = Date.now() + SELECTION_GUARD_MS;
    interactionGuardUntilRef.current = Math.max(interactionGuardUntilRef.current, expiresAt);
    if (source === 'marker') markerGuardUntilRef.current = expiresAt;
  }, []);

  const hasActiveInteractionGuard = useCallback(() => Date.now() < interactionGuardUntilRef.current, []);
  const hasActiveMarkerGuard = useCallback(() => Date.now() < markerGuardUntilRef.current, []);

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

  const providerFilteredFacilities = useMemo(() => {
    let result = providerFacilities.filter((facility) => Number.isFinite(facility.lat) && Number.isFinite(facility.lng));

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

    return result;
  }, [providerFacilities, searchQuery, countyFilters, typeFilters]);

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

  const facilityValidation = useMemo(() => buildFacilityValidationIndex(providerFacilities), [providerFacilities]);

  const filteredRuralServices = useMemo(() => {
    let result = ruralServices;

    if (typeFilters && typeFilters.size > 0 && !typeFilters.has('service') && !typeFilters.has('behavioralHealth')) {
      return [];
    }

    if (countyFilters && countyFilters.size > 0) {
      result = result.filter((service) => countyFilters.has(service.county));
    }

    if (serviceCategoryFilters && serviceCategoryFilters.size > 0) {
      result = result.filter((service) => serviceCategoryFilters.has(service.category));
    }

    return result;
  }, [countyFilters, serviceCategoryFilters, typeFilters]);

  const filteredCommunityServices = useMemo(() => {
    if (typeFilters && typeFilters.size > 0 && !typeFilters.has('service')) {
      return [];
    }

    return filteredRuralServices.filter(isCommunitySupportService);
  }, [filteredRuralServices, typeFilters]);

  const filteredBehavioralHealthServices = useMemo(() => {
    if (typeFilters && typeFilters.size > 0 && !typeFilters.has('behavioralHealth')) {
      return [];
    }

    return filteredRuralServices.filter(isBehavioralHealthService);
  }, [filteredRuralServices, typeFilters]);

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
        metric.broadbandServedPercent = bbData.servedPercent;
        metric.broadbandUnservedPercent = bbData.unservedPercent;
      }

      const cellData = CELLULAR_BY_COUNTY.get(name);
      if (cellData) {
        metric.cellularReliability = cellData.reliabilityCategory;
        metric.cellularCarriers = formatCarriers(cellData.carriers);
      }

      metricsByCounty.set(name, metric);
    });

    return metricsByCounty;
  }, [filteredRuralServices, providerFacilities, radiusKm, broadbandReady]);

  const updateCountyHoverPreview = useCallback((county: string, event: L.LeafletMouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const originalEvent = event.originalEvent as MouseEvent | undefined;
    const x = rect && originalEvent ? originalEvent.clientX - rect.left : 16;
    const y = rect && originalEvent ? originalEvent.clientY - rect.top : 16;
    const metrics = countyHoverMetrics.get(county) ?? { county };

    setCountyHoverPreview({ ...metrics, county, x, y });
  }, [countyHoverMetrics]);

  const clearCountyHoverPreview = useCallback(() => {
    setCountyHoverPreview(null);
  }, []);

  const countyHoverPreviewStyle = useMemo(() => {
    if (!countyHoverPreview || !containerRef.current) return null;

    const width = 208;
    const height = 112;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const horizontalOffset = 18;
    const verticalOffset = 14;
    const preferLeft = countyHoverPreview.x > containerWidth * 0.58;
    const preferAbove = countyHoverPreview.y > containerHeight * 0.62;
    const proposedLeft = preferLeft
      ? countyHoverPreview.x - width - horizontalOffset
      : countyHoverPreview.x + horizontalOffset;
    const proposedTop = preferAbove
      ? countyHoverPreview.y - height - verticalOffset
      : countyHoverPreview.y + verticalOffset;

    return {
      width,
      left: Math.min(Math.max(proposedLeft, 12), Math.max(containerWidth - width - 12, 12)),
      top: Math.min(Math.max(proposedTop, 12), Math.max(containerHeight - height - 12, 12)),
    };
  }, [countyHoverPreview]);

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

    const map = L.map(containerRef.current, {
      center: [39.5, -117.0],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

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
    coverageGreyRef.current = L.layerGroup().addTo(map);
    operationalCoverageRef.current = L.layerGroup().addTo(map);
    operationalResponseMarkerRef.current = L.layerGroup().addTo(map);
    radiusRef.current = L.layerGroup().addTo(map);
    gapsRef.current = L.layerGroup().addTo(map);
    engagementGapRef.current = L.layerGroup().addTo(map);
    servicePresenceHaloRef.current = L.featureGroup().addTo(map);
    servicePresenceMarkerRef.current = L.featureGroup().addTo(map);
    // Group-level click handler for service markers — same safety-net pattern
    // as the MarkerClusterGroup handlers that make provider markers reliable.
    (servicePresenceMarkerRef.current as any).on('click', (e: any) => {
      const marker = e.layer as MapPointMarker | undefined;
      if (marker?.__entity) {
        selectMarkerEntity(marker.__entity as PointSelectionEntity, 'service-group-click', e, marker);
      }
    });
    behavioralHealthHaloRef.current = L.featureGroup().addTo(map);
    behavioralHealthMarkerRef.current = L.featureGroup().addTo(map);
    // Group-level click handler for behavioral health markers
    (behavioralHealthMarkerRef.current as any).on('click', (e: any) => {
      const marker = e.layer as MapPointMarker | undefined;
      if (marker?.__entity) {
        selectMarkerEntity(marker.__entity as PointSelectionEntity, 'bh-group-click', e, marker);
      }
    });
    markersRef.current = markerClusterFactory?.({
      maxClusterRadius: (zoom: number) => getDeclutterRadiusByZoom(zoom),
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: false,
      disableClusteringAtZoom: 13,
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

    // Facility cluster group click handler (same pattern as pointCluster)
    (markersRef.current as any)?.on?.('click', (e: any) => {
      const marker = e.layer as MapPointMarker | undefined;
      selectMarkerEntity(marker?.__entity as PointSelectionEntity | undefined, 'facility-cluster-marker', e, marker);
    });
    topProviderMarkersRef.current = L.layerGroup().addTo(map);
    pointClusterRef.current = markerClusterFactory?.({
      maxClusterRadius: (zoom: number) => getDeclutterRadiusByZoom(zoom),
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: false,
      disableClusteringAtZoom: 13,
      removeOutsideVisibleBounds: false,
      animate: true,
      animateAddingMarkers: false,
      spiderfyDistanceMultiplier: 0.85,
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
    (pointClusterRef.current as any)?.on?.('click', (e: any) => {
      const marker = e.layer as MapPointMarker | undefined;
      selectMarkerEntity(marker?.__entity as PointSelectionEntity | undefined, 'declutter-cluster-marker', e, marker);
    });
    fteCapacityRef.current = L.layerGroup().addTo(map);
    labelsRef.current = L.layerGroup().addTo(map);
    engagementGapLabelRef.current = L.layerGroup().addTo(map);
    highlightsRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setMapZoom(map.getZoom());
    setMapReady(true);

    map.on('click', () => {
      if (hasActiveInteractionGuard()) {
        logMapSelectionDebug('background-click-ignored-due-to-guard');
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

  // Draw state boundary
  useEffect(() => {
    if (!stateBoundaryRef.current) return;
    stateBoundaryRef.current.clearLayers();

    const geoLayer = createGeoJsonLayer(
      NEVADA_FEATURE,
      MAP_PANES.stateOutline,
      {
        color: 'hsl(240, 5%, 55%)',
        weight: 2,
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
    countyFillRef.current.clearLayers();
    countyBorderRef.current.clearLayers();
    labelsRef.current?.clearLayers();
    if (!layers.counties) return;

    nevadaCounties.forEach(county => {
      const clipped = getCountyFeature(county.name);
      if (!clipped) return;

      const hitArea = L.geoJSON(clipped, {
        pane: MAP_PANES.countyPolygons,
        style: {
          color: 'transparent',
          weight: 0,
          fillColor: 'hsla(200, 40%, 65%, 0.01)',
          fillOpacity: 1,
        },
        interactive: true,
        smoothFactor: 0,
      } as any);

      hitArea.on('mouseover', (event: L.LeafletMouseEvent) => {
        updateCountyHoverPreview(county.name, event);
        hitArea.setStyle({ fillColor: 'hsla(200, 40%, 65%, 0.06)' });
      });
      hitArea.on('mousemove', (event: L.LeafletMouseEvent) => {
        updateCountyHoverPreview(county.name, event);
      });
      hitArea.on('mouseout', () => {
        clearCountyHoverPreview();
        hitArea.setStyle({ fillColor: 'hsla(200, 40%, 65%, 0.01)' });
      });
      hitArea.on('click', (e: L.LeafletEvent) => {
        selectCountyEntity(county.name, 'county-hit-area', e);
      });
      countyFillRef.current!.addLayer(hitArea);

      const borderLayer = createGeoJsonLayer(
        clipped,
        MAP_PANES.countyBorders,
        {
          color: 'hsl(240, 5%, 75%)',
          weight: 1,
          fillColor: 'transparent',
          fillOpacity: 0,
          dashArray: '4 4',
        },
        false,
      );
      countyBorderRef.current!.addLayer(borderLayer);

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
        pane: MAP_PANES.labels,
      }).addTo(labelsRef.current!);
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

    if (selectedCounty) {
      const selectedCountyFeature = getCountyFeature(selectedCounty);
      if (selectedCountyFeature) {
        const selectedLayer = createGeoJsonLayer(
          selectedCountyFeature,
          MAP_PANES.highlights,
          {
            color: 'hsl(200, 60%, 50%)',
            weight: 2.5,
            fillColor: 'hsla(200, 60%, 50%, 0.08)',
            fillOpacity: 1,
          },
          false,
        );
        highlightsRef.current.addLayer(selectedLayer);
      }
    }

    if (!layers.fteCapacity || !selectedFteId) return;
    const fte = fteCapacityData.find(f => f.id === selectedFteId);
    if (!fte || !fte.hubLocation) return;

    const roleColor = FTE_ROLE_COLORS[fte.id]?.primary ?? 'hsl(0,0%,50%)';
    fte.counties.forEach((countyName) => {
      const countyFeature = getCountyFeature(countyName);
      if (!countyFeature) return;

      const serviceAreaLayer = createGeoJsonLayer(
        countyFeature,
        MAP_PANES.highlights,
        {
          color: roleColor,
          weight: 2,
          dashArray: '6 4',
          fillColor: roleColor,
          fillOpacity: 0.08,
        },
        false,
      );
      highlightsRef.current!.addLayer(serviceAreaLayer);
    });
  }, [layers.fteCapacity, selectedCounty, selectedFteId]);

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

    const applyMarkerPriority = (marker: MapPointMarker, state: 'default' | 'hovered' | 'selected') => {
      const baseOffset = marker.__baseZIndexOffset ?? POINT_MARKER_PRIORITY.base;
      const resolvedOffset = state === 'selected'
        ? baseOffset + POINT_MARKER_PRIORITY.selectedBoost
        : state === 'hovered'
          ? baseOffset + POINT_MARKER_PRIORITY.hoveredBoost
          : baseOffset;

      marker.__priorityState = state;
      marker.setZIndexOffset(resolvedOffset);
    };

    const prioritizeOnHover = (marker: MapPointMarker) => {
      if (marker.__priorityState === 'selected') return;
      applyMarkerPriority(marker, 'hovered');
    };

    const resetHoverPriority = (marker: MapPointMarker) => {
      if (marker.__priorityState === 'selected') return;
      applyMarkerPriority(marker, 'default');
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
      const markerSize = MAP_PIN_VISUALS.servicePresence.size;
      const hitSize = Math.max(markerSize, 28);
      const servicePresenceIcon = L.divIcon({
        className: '',
        html: getSharedPinSvgMarkup('servicePresence', markerSize),
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize],
        tooltipAnchor: [0, -hitSize],
      });

      filteredCommunityServices.forEach((service) => {
        const countyServices = communityServicesByCounty.get(service.county) ?? [service];
        const [displayLat, displayLng] = displayCoordinates.get(`service:${service.id}`) ?? [service.lat, service.lng];

        const marker = L.marker([displayLat, displayLng], {
          pane: MAP_PANES.servicePresence,
          icon: servicePresenceIcon,
          zIndexOffset: POINT_MARKER_PRIORITY.base,
        }) as MapPointMarker;

        marker.__pointKind = 'servicePresence';
        marker.__baseZIndexOffset = POINT_MARKER_PRIORITY.base;
        marker.__entity = { type: 'ruralService', service };
        marker.__entityType = 'ruralService';
        marker.__entityId = service.id;
        marker.__entityName = service.name;
        applyMarkerPriority(marker, 'default');
        logMapSelectionDebug('marker-rendered', marker.__entity, { source: 'service-marker', pointKind: marker.__pointKind });

        marker.on('mouseover', () => {
          prioritizeOnHover(marker);
          onEntityHoverRef.current?.({ type: 'ruralService', service });
        });
        marker.on('mouseout', () => {
          resetHoverPriority(marker);
          onEntityHoverRef.current?.(null);
        });
        marker.on('click', (event: L.LeafletEvent) => {
          selectMarkerEntity(marker.__entity as PointSelectionEntity | undefined, 'service-marker-leaflet', event, marker);
        });

        // Native DOM click backup — fires even when Leaflet's internal
        // event dispatch doesn't propagate through custom panes.
        marker.once('add', () => {
          const iconEl = marker.getElement?.();
          if (iconEl) {
            iconEl.addEventListener('click', (nativeEvent: MouseEvent) => {
              nativeEvent.stopPropagation();
              logMapSelectionDebug('native-dom-click', marker.__entity, { source: 'service-marker-native' });
              selectMarkerEntity(marker.__entity as PointSelectionEntity | undefined, 'service-marker-native', null, marker);
            });
          }
        });

        marker.bindTooltip(
          `
            <div style="padding: 8px 12px; font-size: 13px; width: 240px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
              <div style="font-weight: 600; margin-bottom: 2px;">${service.name}</div>
              <div style="color: hsl(var(--muted-foreground)); font-size: 11px;">${service.city}, ${service.county} County</div>
              ${service.address ? `<div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 1px;">${service.address}</div>` : ''}
              <div style="color: hsl(var(--muted-foreground)); font-size: 10px; margin-top: 2px;">${service.category}</div>
            </div>
          `,
          {
            direction: 'top',
            offset: [0, -8],
            className: 'facility-tooltip',
          }
        );

        servicePresenceMarkerRef.current!.addLayer(marker);
      });
    }

    if (layers.behavioralHealth && !topProvidersOnly) {
      const markerSize = MAP_PIN_VISUALS.behavioralHealth.size;
      const hitSize = Math.max(markerSize, 28);
      const behavioralHealthIcon = L.divIcon({
        className: '',
        html: getSharedPinSvgMarkup('behavioralHealth', markerSize),
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize],
        tooltipAnchor: [0, -hitSize],
      });

      filteredBehavioralHealthServices.forEach((service) => {
        const countyServices = behavioralHealthServicesByCounty.get(service.county) ?? [service];
        const [displayLat, displayLng] = displayCoordinates.get(`behavioral-health:${service.id}`) ?? [service.lat, service.lng];

        const marker = L.marker([displayLat, displayLng], {
          pane: MAP_PANES.behavioralHealth,
          icon: behavioralHealthIcon,
          zIndexOffset: POINT_MARKER_PRIORITY.base,
        }) as MapPointMarker;

        marker.__pointKind = 'behavioralHealth';
        marker.__baseZIndexOffset = POINT_MARKER_PRIORITY.base;
        marker.__entity = { type: 'ruralService', service };
        marker.__entityType = 'ruralService';
        marker.__entityId = service.id;
        marker.__entityName = service.name;
        applyMarkerPriority(marker, 'default');
        logMapSelectionDebug('marker-rendered', marker.__entity, { source: 'behavioral-health-marker', pointKind: marker.__pointKind });

        marker.on('mouseover', () => {
          prioritizeOnHover(marker);
          onEntityHoverRef.current?.({ type: 'ruralService', service });
        });
        marker.on('mouseout', () => {
          resetHoverPriority(marker);
          onEntityHoverRef.current?.(null);
        });
        marker.on('click', (event: L.LeafletEvent) => {
          selectMarkerEntity({ type: 'ruralService', service }, 'bh-marker-leaflet', event, marker);
        });

        marker.once('add', () => {
          const iconEl = marker.getElement?.();
          if (iconEl) {
            iconEl.addEventListener('click', (nativeEvent: MouseEvent) => {
              nativeEvent.stopPropagation();
              logMapSelectionDebug('native-dom-click', marker.__entity, { source: 'bh-marker-native' });
              selectMarkerEntity(marker.__entity as PointSelectionEntity | undefined, 'bh-marker-native', null, marker);
            });
          }
        });

        marker.bindTooltip(
          `
            <div style="padding: 8px 12px; font-size: 13px; width: 240px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
              <div style="font-weight: 600; margin-bottom: 2px;">${service.name}</div>
              <div style="color: hsl(var(--muted-foreground)); font-size: 11px;">${service.city}, ${service.county} County</div>
              ${service.address ? `<div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 1px;">${service.address}</div>` : ''}
              <div style="color: hsl(var(--muted-foreground)); font-size: 10px; margin-top: 2px;">Behavioral Health · ${service.category}</div>
            </div>
          `,
          {
            direction: 'top',
            offset: [0, -8],
            className: 'facility-tooltip',
          }
        );

        behavioralHealthMarkerRef.current!.addLayer(marker);
      });
    }

    if (shouldRenderProviderLocations) {
      const showUtilization = layers.utilizationIntensity;

      visibleFacilities.forEach(facility => {
        const util = getFacilityUtilization(facility);
        const validation = facilityValidation.records.get(facility.id);
        const dataConfidence = getFacilityDataConfidence(facility);
        const [displayLat, displayLng] = displayCoordinates.get(`facility:${facility.id}`) ?? [facility.lat, facility.lng];
        const useUniformSize = topProvidersOnly && mapZoom < 11;
        const scaledSize = showUtilization && util && !useUniformSize
          ? getScaledPinSize(MAP_PIN_VISUALS.providerLocations.size, util.totalVisits)
          : MAP_PIN_VISUALS.providerLocations.size;
        const hitSize = Math.max(scaledSize, 28);
        const markerOpacity = dataConfidence === 'Unverified' ? 0.82 : 1;
        const markerHtml = getSharedPinSvgMarkup('providerLocations', scaledSize, {
          color: facility.type === 'hospital' ? 'hsl(var(--hospital))' : 'hsl(var(--clinic))',
          opacity: markerOpacity,
        });

        const icon = L.divIcon({
          className: '',
          html: markerHtml,
          iconSize: [hitSize, hitSize],
          iconAnchor: [hitSize / 2, hitSize],
          tooltipAnchor: [0, -hitSize],
        });

        const marker = L.marker([displayLat, displayLng], {
          icon,
          pane: MAP_PANES.facilityMarkers,
          zIndexOffset: POINT_MARKER_PRIORITY.base,
        }) as MapPointMarker;

        marker.__pointKind = 'providerLocations';
        marker.__providerType = facility.type === 'hospital' ? 'hospital' : 'clinic';
        marker.__baseZIndexOffset = POINT_MARKER_PRIORITY.base;
        marker.__entity = { type: 'facility', facility };
        marker.__entityType = 'facility';
        marker.__entityId = facility.id;
        marker.__entityName = facility.name;
        applyMarkerPriority(marker, 'default');
        logMapSelectionDebug('marker-rendered', marker.__entity, { source: 'facility-marker', pointKind: marker.__pointKind });

        marker.on('mouseover', () => {
          prioritizeOnHover(marker);
        });
        marker.on('mouseout', () => {
          resetHoverPriority(marker);
        });

        marker.on('click', (event: L.LeafletEvent) => {
          selectMarkerEntity(marker.__entity as PointSelectionEntity | undefined, 'facility-marker', event, marker);

          if (!facilityValidationMode || !validation) return;

          const validationHtml = `
            <div style="padding: 8px 12px; font-size: 12px; width: 260px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
              <div style="font-weight: 700; margin-bottom: 4px;">${facility.name}</div>
              <div style="color: hsl(240, 4%, 46%); margin-bottom: 6px;">${getFacilityTypeLabel(facility)} · ${facility.county} County</div>
              <div><strong>Source address:</strong> ${validation.sourceAddress}</div>
              <div><strong>Latitude:</strong> ${facility.lat.toFixed(4)}</div>
              <div><strong>Longitude:</strong> ${facility.lng.toFixed(4)}</div>
              <div><strong>Geocoding source:</strong> ${getFacilityCoordinateSourceLabel(validation.coordinateSource)}</div>
              <div><strong>Confidence:</strong> ${validation.confidence === 'verified' ? 'Verified' : validation.confidence === 'manual_review' ? 'Approximate — manual review' : 'Approximate'}</div>
              ${validation.notes ? `<div style="margin-top: 6px; color: hsl(240, 4%, 46%);">${validation.notes}</div>` : ''}
              ${validation.issues.length > 0 ? `<div style="margin-top: 6px;"><strong>Checks:</strong><ul style="margin: 4px 0 0 18px; padding: 0;">${validation.issues.map((issue) => `<li>${issue}</li>`).join('')}</ul></div>` : ''}
            </div>
          `;

          marker.bindPopup(validationHtml, { maxWidth: 280 }).openPopup();
        });

        // Native DOM click backup — same pattern as service/behavioral markers
        marker.once('add', () => {
          const iconEl = marker.getElement?.();
          if (iconEl) {
            iconEl.addEventListener('click', (nativeEvent: MouseEvent) => {
              nativeEvent.stopPropagation();
              logMapSelectionDebug('native-dom-click', marker.__entity, { source: 'facility-marker-native' });
              selectMarkerEntity(marker.__entity as PointSelectionEntity | undefined, 'facility-marker-native', null, marker);
            });
          }
        });

        const classification = getFacilityClassification(facility);
        const typeLabel = classification === 'clinic_provider' && facility.tier === 'tier1'
          ? 'Clinic / Community Provider'
          : getFacilityTypeLabel(facility);
        const utilHtml = showUtilization && util
          ? `<div style="border-top: 1px solid hsl(240, 5%, 88%); margin-top: 4px; padding-top: 4px; font-size: 10px; color: hsl(270, 40%, 45%);">
              <div>Members: ${util.totalMembers.toLocaleString()} · Visits: ${util.totalVisits.toLocaleString()}</div>
              <div>Visits/Member: ${util.visitsPerMember} · Rank #${util.rank}</div>
            </div>`
          : '';

        const claimsMetrics = getProviderClaimsMetrics(facility);
        const penetrationColor = claimsMetrics && claimsMetrics.visitPenetrationRate < 0.5
          ? 'hsl(38, 92%, 50%)' : 'hsl(240, 4%, 46%)';
        const avgEncColor = claimsMetrics && claimsMetrics.avgEncountersPerSeenMember > 10
          ? 'hsl(0, 72%, 51%)' : 'hsl(240, 4%, 46%)';
        const claimsHtml = claimsMetrics
          ? `<div style="border-top: 1px solid hsl(240, 5%, 88%); margin-top: 4px; padding-top: 4px; font-size: 10px;">
              <div style="color: hsl(240, 4%, 46%);">Total Members Attributed: ${claimsMetrics.totalMembersAttributed.toLocaleString()}</div>
              <div style="color: hsl(240, 4%, 46%);">Members with ≥1 Visit: ${claimsMetrics.membersSeen.toLocaleString()}</div>
              <div style="color: ${penetrationColor};">Visit Penetration Rate: ${(claimsMetrics.visitPenetrationRate * 100).toFixed(1)}%</div>
              <div style="color: hsl(240, 4%, 46%);">Total Encounters: ${claimsMetrics.totalEncounters.toLocaleString()}</div>
              <div style="color: ${avgEncColor};">Avg Encounters per Seen Member: ${claimsMetrics.avgEncountersPerSeenMember.toFixed(1)}</div>
              <div style="color: hsl(240, 4%, 60%); font-size: 9px; margin-top: 3px; font-style: italic;">Based on aggregate claims data (not time-bound)</div>
            </div>`
          : '';

        const tooltipContent = `
          <div style="padding: 8px 12px; font-size: 13px; width: 240px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
            <div style="font-weight: 600; margin-bottom: 2px;">${facility.name}</div>
            <div style="color: hsl(240, 4%, 46%); font-size: 11px;">${facility.city}, ${facility.county} County</div>
            ${facility.address ? `<div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 1px;">${facility.address}</div>` : ''}
            <div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 2px;">${typeLabel}</div>
            <div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 4px;">Data Confidence: ${dataConfidence}</div>
            ${utilHtml}
            ${claimsHtml}
          </div>
        `;
        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -8],
          className: 'facility-tooltip',
        });

        nextFacilityMarkers.push(marker);
      });
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
  }, [behavioralHealthServicesByCounty, communityServicesByCounty, facilityValidation, facilityValidationMode, filteredBehavioralHealthServices, filteredCommunityServices, layers.behavioralHealth, layers.serviceLocations, layers.services, layers.utilizationIntensity, logMapSelectionDebug, mapZoom, onFacilityClick, providerVisibleFacilities, selectMarkerEntity, topProvidersOnly]);

  // Draw coverage radii
  useEffect(() => {
    if (!radiusRef.current) return;
    radiusRef.current.clearLayers();

    if (!coverageRadius) return;

    const visibleFacilities = topProvidersOnly
      ? providerVisibleFacilities
      : filteredFacilities;

      const accessTier = getProviderAccessTierByKm(radiusKm);

      visibleFacilities.forEach(facility => {
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

        if (coverageGaps) {
          colors.fill = 'hsla(0, 0%, 100%, 0.85)';
        }

        const halo = L.circle([facility.lat, facility.lng], {
          pane: MAP_PANES.driveRadii,
          radius: radiusKm * 1000,
          color: `hsla(0, 0%, 100%, ${colors.haloOpacity})`,
          weight: 4,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false,
        });
        radiusRef.current!.addLayer(halo);

        const circle = L.circle([facility.lat, facility.lng], {
          pane: MAP_PANES.driveRadii,
          radius: radiusKm * 1000,
          color: colors.stroke,
          weight: 2.5,
          fillColor: colors.fill,
          fillOpacity: 1,
          dashArray: colors.dashArray,
          interactive: false,
        });
        radiusRef.current!.addLayer(circle);
      });
  }, [filteredFacilities, coverageRadius, coverageGaps, radiusKm, topProvidersOnly, providerVisibleFacilities]);

  // Draw coverage gap overlays
  useEffect(() => {
    if (!gapsRef.current) return;
    gapsRef.current.clearLayers();

    if (!coverageGaps) return;

    // Coverage gaps should only subtract true fixed-service hospital footprints (exclude clinic/provider radii)
    const eligibleFacilities = facilities.filter(f => f.type === 'hospital');

    const analysisFeature: Feature<Polygon | MultiPolygon> = { type: "Feature", properties: {}, geometry: nevadaBoundaryGeoJSON };

    if (eligibleFacilities.length === 0) {
      const geoLayer = L.geoJSON(analysisFeature as any, {
        style: {
          color: 'hsla(0, 84%, 60%, 0.5)',
          weight: 1.5,
          fillColor: 'hsla(0, 84%, 60%, 0.15)',
          fillOpacity: 1,
        },
      });
      gapsRef.current.addLayer(geoLayer);
      return;
    }

    try {
      const buffers = eligibleFacilities.map(f => {
        const pt = turfPoint([f.lng, f.lat]);
        return buffer(pt, radiusKm, { units: 'kilometers' }) as Feature<Polygon>;
      });

      // Union all buffers in one pass to eliminate internal overlap seams.
      // Fallback keeps every buffer if Turf returns null for non-overlapping sets.
      const mergedCoverage = (union(featureCollection(buffers) as any) as Feature<Polygon | MultiPolygon> | null)
        ?? ({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: buffers.map(b => b.geometry.coordinates),
          },
        } as Feature<MultiPolygon>);

      // Morphological close: expand then shrink to seal micro-gaps between adjacent buffers
      const expanded = buffer(mergedCoverage, 0.5, { units: 'kilometers' });
      const cleaned = expanded ? buffer(expanded, -0.5, { units: 'kilometers' }) ?? mergedCoverage : mergedCoverage;

      const fc = featureCollection([analysisFeature, cleaned]);
      const gapGeometry = difference(fc as any);

      if (gapGeometry) {
        const geoLayer = L.geoJSON(gapGeometry as any, {
          pane: MAP_PANES.gapOverlays,
          style: {
            color: 'hsla(0, 84%, 60%, 0.13)',
            weight: 0,
            fillColor: 'hsla(0, 84%, 60%, 0.13)',
            fillOpacity: 1,
          },
        });
        geoLayer.on('click', (e: L.LeafletEvent) => {
          selectOverlayEntity({ type: 'coverageGap', radiusKm }, 'coverage-gap-overlay', e);
        });
        gapsRef.current.addLayer(geoLayer);
      }
    } catch (e) {
      console.error('Coverage gap calculation error:', e);
    }
  }, [coverageGaps, facilities, radiusKm, selectOverlayEntity]);

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

      const marker = L.marker(county.center, {
        icon: buildIcon(selectedCounty === county.name),
        interactive: true,
        pane: MAP_PANES.responseCapabilityMarkers,
        zIndexOffset: category === 'active' ? 820 : category === 'scheduled' ? 780 : 740,
      });

      marker.on('mouseover', (event: L.LeafletMouseEvent) => {
        marker.setIcon(buildIcon(true));
        updateCountyHoverPreview(county.name, event);
      });
      marker.on('mousemove', (event: L.LeafletMouseEvent) => updateCountyHoverPreview(county.name, event));
      marker.on('mouseout', () => {
        marker.setIcon(buildIcon(selectedCounty === county.name));
        clearCountyHoverPreview();
      });
      marker.on('click', (event: L.LeafletEvent) => {
        selectCountyEntity(county.name, 'response-capability-marker', event);
      });

      marker.bindTooltip(
        `
          <div style="padding: 8px 12px; font-size: 13px; width: 240px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
            <div style="font-weight: 600; margin-bottom: 2px;">${county.name}</div>
            <div style="color: hsl(var(--muted-foreground)); font-size: 11px;">${RESPONSE_CAPABILITY_META[category].label}</div>
            <div style="color: hsl(var(--muted-foreground)); font-size: 10px; margin-top: 2px;">${RESPONSE_CAPABILITY_META[category].description}</div>
          </div>
        `,
        {
          direction: 'top',
          offset: [0, -8],
          className: 'facility-tooltip',
        },
      );

      operationalResponseMarkerRef.current!.addLayer(marker);
    });
  }, [activeCoverageZone, clearCountyHoverPreview, coverageGaps, coverageRadiusKm, layers.operationalCoverage, selectCountyEntity, selectedCounty, updateCountyHoverPreview]);

  // ── FTE Capacity hub indicators ──
  useEffect(() => {
    if (!fteCapacityRef.current) return;
    fteCapacityRef.current.clearLayers();

    if (!layers.fteCapacity || topProvidersOnly) return;

    fteCapacityData.forEach(fte => {
      if (!fte.hubLocation) return;

      const roleColor = FTE_ROLE_COLORS[fte.id]?.primary ?? 'hsl(0,0%,50%)';
      const isSelected = selectedFteId === fte.id;
      const coverageLabel = fte.hubLocation ? 'Field' : 'Remote';

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          display:flex; align-items:center; gap:5px;
          background:white; border:2px solid ${roleColor};
          border-radius:14px; padding:4px 10px 4px 6px;
          box-shadow:${isSelected ? `0 0 0 3px ${roleColor}40, 0 1px 4px hsla(0,0%,0%,0.15)` : '0 1px 4px hsla(0,0%,0%,0.15)'};
          cursor:pointer; white-space:nowrap;
          min-width:44px; min-height:28px;
          position:relative;
          ${isSelected ? 'animation: fte-pulse 1.5s ease-in-out infinite;' : ''}
        ">
          <div style="width:10px;height:10px;border-radius:50%;background:${roleColor};flex-shrink:0;border:1.5px solid white;box-shadow:0 0 0 1px ${roleColor};"></div>
          <span style="font-size:10px;font-weight:600;color:${roleColor};">${fte.label}</span>
          <span style="font-size:9px;color:hsl(0,0%,50%);">${coverageLabel}</span>
        </div>`,
        iconSize: [150, 28],
        iconAnchor: [0, 14],
      });

      const marker = L.marker([fte.hubLocation.lat, fte.hubLocation.lng], { icon, interactive: true, zIndexOffset: 1000 });
      marker.options.pane = MAP_PANES.highlights;
      marker.on('click', (e: L.LeafletEvent) => {
        stopInteractionEvent(e);
        armInteractionGuard('overlay');
        clearSelectedPointMarkerRef.current();
        onFteHubClickRef.current?.(fte.id);
      });
      fteCapacityRef.current!.addLayer(marker);
    });
  }, [armInteractionGuard, layers.fteCapacity, selectedFteId, stopInteractionEvent]);

  // ── Utilization Intensity choropleth (purple ramp) ──
  useEffect(() => {
    if (!utilizationRef.current) return;
    utilizationRef.current.clearLayers();
    if (!layers.utilizationIntensity || coverageGaps) return;

    nevadaCounties.forEach(county => {
      const util = getCountyUtilization(county.name);
      const tier = getUtilizationTier(util.avgVisitsPerMember);
      const colors = UTILIZATION_COLORS[tier];

      const clipped = getCountyFeature(county.name);
      if (!clipped) return;

      const geoLayer = L.geoJSON(clipped, {
        pane: MAP_PANES.countyPolygons,
        style: {
          color: colors.border,
          weight: 1,
          fillColor: colors.fill,
          fillOpacity: 1,
        },
      });
      geoLayer.on('click', (e: L.LeafletEvent) => {
        const memberCount = memberVolumeData.find(entry => entry.county === county.name)?.memberCount ?? util.totalMembers;
        selectOverlayEntity({ type: 'memberVolume', county: county.name, memberCount }, 'utilization-county', e);
      });
      utilizationRef.current!.addLayer(geoLayer);
    });
  }, [clearCountyHoverPreview, coverageGaps, layers.utilizationIntensity, selectOverlayEntity, updateCountyHoverPreview]);

  // ── Engagement Gap county outlines (orange = gap, yellow = watchlist) ──
  useEffect(() => {
    if (!engagementGapRef.current) return;
    engagementGapRef.current.clearLayers();
    engagementGapLabelRef.current?.clearLayers();
    if (!layers.engagementGap) return;

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
      geoLayer.on('mousemove', (event: L.LeafletMouseEvent) => {
        updateCountyHoverPreview(metrics.county, event);
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
      geoLayer.on('mousemove', (event: L.LeafletMouseEvent) => updateCountyHoverPreview(result.county, event));
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
  }, [clearCountyHoverPreview, engagementPriorityCounties, layers.engagementGap, maxPriorityUnengagedMembers, selectCountyEntity, updateCountyHoverPreview]);

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

    const RELIABILITY_FILL: Record<import('@/data/cellular-coverage').CellularReliability, string> = {
      Strong: 'hsla(160, 55%, 40%, 0.14)',
      Moderate: 'hsla(44, 90%, 50%, 0.16)',
      Weak: 'hsla(20, 85%, 55%, 0.16)',
      None: 'hsla(240, 5%, 60%, 0.14)',
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
          fillColor: RELIABILITY_FILL[cell.reliabilityCategory],
          fillOpacity: 1,
        },
        interactive: false,
      });
      cellularRef.current!.addLayer(geoLayer);
    });
  }, [layers.cellularCoverage]);

  return (
    <div className="relative h-full w-full" data-tutorial="map-region">
      <div ref={containerRef} className="h-full w-full" />
      <TooltipProvider delayDuration={120}>
        {countyHoverPreview && countyHoverPreviewStyle && (
          <div
            className="pointer-events-none absolute z-[810] rounded-lg border border-border bg-card/95 px-2.5 py-2 text-card-foreground shadow-md backdrop-blur-sm"
            style={countyHoverPreviewStyle}
          >
            <p className="text-[13px] font-semibold leading-4 text-foreground">{getCountyDisplayName(countyHoverPreview.county)}</p>
            <div className="mt-1.5 space-y-1">
              {typeof countyHoverPreview.unengagedMembers === 'number' && (
                <CountyHoverMetricRow label="Unengaged members" value={numberFormatter.format(countyHoverPreview.unengagedMembers)} emphasize />
              )}
              {typeof countyHoverPreview.providerCount === 'number' && (
                <CountyHoverMetricRow label="Providers" value={numberFormatter.format(countyHoverPreview.providerCount)} />
              )}
              {typeof countyHoverPreview.serviceCount === 'number' && (
                <CountyHoverMetricRow label="Services" value={numberFormatter.format(countyHoverPreview.serviceCount)} />
              )}
              {typeof countyHoverPreview.coverageGapPercent === 'number' && (
                <div className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-[10px] leading-4">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      Coverage gap
                      <CoverageGapInfoButton />
                    </span>
                    <span className="text-right font-medium tabular-nums text-foreground/85">{countyHoverPreview.coverageGapPercent}%</span>
                  </div>
                  <div className="border-t border-border/70 pt-1 text-[10px] leading-4 text-muted-foreground">
                    Status: {getCoverageGapSeverity(countyHoverPreview.coverageGapPercent)} coverage gap
                  </div>
                </div>
              )}
              {layers.broadbandAccess && countyHoverPreview.broadbandStatus && (
                <div className="border-t border-border/70 pt-1 space-y-0.5">
                  <CountyHoverMetricRow label="Broadband" value={countyHoverPreview.broadbandStatus} />
                  {typeof countyHoverPreview.broadbandServedPercent === 'number' && (
                    <CountyHoverMetricRow label="Served" value={`${countyHoverPreview.broadbandServedPercent}%`} />
                  )}
                  {typeof countyHoverPreview.broadbandUnservedPercent === 'number' && countyHoverPreview.broadbandUnservedPercent > 0 && (
                    <CountyHoverMetricRow label="Unserved" value={`${countyHoverPreview.broadbandUnservedPercent}%`} />
                  )}
                </div>
              )}
              {layers.cellularCoverage && countyHoverPreview.cellularReliability && (
                <div className="border-t border-border/70 pt-1 space-y-0.5">
                  <CountyHoverMetricRow label="Cellular" value={countyHoverPreview.cellularReliability} />
                  {countyHoverPreview.cellularCarriers && (
                    <CountyHoverMetricRow label="Carriers" value={countyHoverPreview.cellularCarriers} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </TooltipProvider>
      {layers.broadbandAccess && (
        <div className="absolute bottom-4 left-4 z-[800] rounded-md border border-border bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur-sm">
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
      {layers.cellularCoverage && (
        <div className={`absolute ${layers.broadbandAccess ? 'bottom-[5.5rem]' : 'bottom-4'} left-4 z-[800] rounded-md border border-border bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur-sm`}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Cellular Coverage</p>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(160, 55%, 40%, 0.35)' }} />
              <span className="text-foreground/80">Strong</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(44, 90%, 50%, 0.35)' }} />
              <span className="text-foreground/80">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(20, 85%, 55%, 0.35)' }} />
              <span className="text-foreground/80">Weak</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2.5 w-4 rounded-sm" style={{ background: 'hsla(240, 5%, 60%, 0.35)' }} />
              <span className="text-foreground/80">None</span>
            </div>
          </div>
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
