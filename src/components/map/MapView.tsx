import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Info } from 'lucide-react';
import { Facility } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { ruralServices } from '@/data/rural-services';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import { MapEntity } from '@/components/map/CoverageDetailPanel';
import { getActiveCoverageZone } from '@/utils/coverageZones';
import { fteCapacityData, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { getCountyUtilization, getUtilizationTier, UTILIZATION_COLORS, getFacilityUtilization, getScaledPinSize, isTopProvider, getEngagementGapCounties, getEngagementGapResults, EngagementGapResult, WASHOE_URBAN_RURAL_LAT, getFilteredEngagementPriorityCounties, getCountyEngagementMetrics } from '@/utils/utilizationAggregation';
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

interface MapViewProps {
  facilities: Facility[];
  allFacilities?: Facility[];
  layers: {
    counties: boolean;
    services: boolean;
    serviceLocations: boolean;
    operationalCoverage: boolean;
    fteCapacity: boolean;
    utilizationIntensity: boolean;
    engagementGap: boolean;
  };
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
  coverageGapPercent?: number;
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

const MAP_PANES = {
  stateOutline: 'state-outline-pane',
  countyPolygons: 'county-polygons-pane',
  countyBorders: 'county-borders-pane',
  operationalAreas: 'operational-areas-pane',
  driveRadii: 'drive-radii-pane',
  gapOverlays: 'gap-overlays-pane',
  facilityMarkers: 'facility-markers-pane',
  labels: 'labels-pane',
  highlights: 'highlights-pane',
} as const;

const PANE_Z_INDEX: Record<(typeof MAP_PANES)[keyof typeof MAP_PANES], number> = {
  [MAP_PANES.stateOutline]: 320,
  [MAP_PANES.countyPolygons]: 330,
  [MAP_PANES.countyBorders]: 340,
  [MAP_PANES.operationalAreas]: 350,
  [MAP_PANES.driveRadii]: 360,
  [MAP_PANES.gapOverlays]: 370,
  [MAP_PANES.facilityMarkers]: 620,
  [MAP_PANES.labels]: 630,
  [MAP_PANES.highlights]: 640,
};

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
    id: 'service-network-markers',
    name: 'Service Network Markers',
    source: 'rural-services',
    controllingToggle: 'layers.services',
    drawOrder: 619,
    group: 'markers',
    filterKey: 'filtered-rural-services',
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
) => L.geoJSON(geometry as any, { pane, style, interactive });

const numberFormatter = new Intl.NumberFormat();

const getCountyDisplayName = (county: string) => county === 'Carson City' ? county : `${county} County`;

const CountyHoverMetricRow = ({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 text-[11px] leading-relaxed">
    <span className="text-muted-foreground">{label}</span>
    <span className={`text-right font-medium tabular-nums ${emphasize ? 'text-foreground' : 'text-foreground/85'}`}>{value}</span>
  </div>
);

const getCoverageGapSeverity = (coverageGapPercent: number): CoverageGapSeverity => {
  if (coverageGapPercent > 60) return 'High';
  if (coverageGapPercent >= 30) return 'Moderate';
  return 'Low';
};

const CoverageGapInfoButton = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={(event) => event.stopPropagation()}
          aria-label="Explain coverage gap"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={10} className="text-[11px] leading-relaxed">
        Percent of county area outside provider coverage radius based on current radius setting.
      </TooltipContent>
    </Tooltip>
  );
};


const MapView = ({ facilities, allFacilities, layers, countyFilters, serviceCategoryFilters, onFacilityClick, onMapClick, searchQuery, radiusKm, coverageRadius, coverageGaps, onEntityClick, onEntityHover, selectedCounty, onFteHubClick, selectedFteId, coverageRadiusKm = 120, topProvidersOnly = false, engagementRateBelow20Only = false }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const serviceNetworkRef = useRef<L.LayerGroup | null>(null);
  const countyFillRef = useRef<L.LayerGroup | null>(null);
  const countyBorderRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const gapsRef = useRef<L.LayerGroup | null>(null);
  const stateBoundaryRef = useRef<L.LayerGroup | null>(null);
  const coverageGreyRef = useRef<L.LayerGroup | null>(null);
  const operationalCoverageRef = useRef<L.LayerGroup | null>(null);
  const fteCapacityRef = useRef<L.LayerGroup | null>(null);
  const utilizationRef = useRef<L.LayerGroup | null>(null);
  const engagementGapRef = useRef<L.LayerGroup | null>(null);
  const engagementGapLabelRef = useRef<L.LayerGroup | null>(null);
  const highlightsRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
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

  const facilityValidation = useMemo(() => buildFacilityValidationIndex(facilities), [facilities]);

  const countyHoverMetrics = useMemo(() => {
    const metricsByCounty = new Map<string, CountyHoverMetrics>();
    const providerCountByCounty = providerFacilities.reduce((acc, facility) => {
      acc.set(facility.county, (acc.get(facility.county) ?? 0) + 1);
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

      metricsByCounty.set(name, metric);
    });

    return metricsByCounty;
  }, [providerFacilities, radiusKm]);

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

    const width = 240;
    const height = 140;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    return {
      width,
      left: Math.min(Math.max(countyHoverPreview.x + 16, 12), Math.max(containerWidth - width - 12, 12)),
      top: Math.min(Math.max(countyHoverPreview.y + 16, 12), Math.max(containerHeight - height - 12, 12)),
    };
  }, [countyHoverPreview]);

  const filteredRuralServices = useMemo(() => {
    let result = ruralServices;

    if (countyFilters && countyFilters.size > 0) {
      result = result.filter((service) => countyFilters.has(service.county));
    }

    if (serviceCategoryFilters && serviceCategoryFilters.size > 0) {
      result = result.filter((service) => serviceCategoryFilters.has(service.category));
    }

    return result;
  }, [countyFilters, serviceCategoryFilters]);

  const ruralServicesByCounty = useMemo(() => {
    const grouped = new Map<string, typeof ruralServices>();
    ruralServices.forEach((service) => {
      const current = grouped.get(service.county) ?? [];
      current.push(service);
      grouped.set(service.county, current);
    });
    return grouped;
  }, []);

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
      'drive-radius-overlay': radiusRef.current,
      'coverage-gap-overlay': gapsRef.current,
      'engagement-gap-overlay': engagementGapRef.current,
      'service-network-markers': serviceNetworkRef.current,
      'facility-markers': markersRef.current,
      'county-labels': labelsRef.current,
      'engagement-gap-labels': engagementGapLabelRef.current,
      'fte-capacity-hubs': fteCapacityRef.current,
      'selection-highlights': highlightsRef.current,
    }),
    [mapReady],
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Strict pane hierarchy prevents path/marker draw-order drift as layers toggle on/off.
    Object.entries(PANE_Z_INDEX).forEach(([paneName, zIndex]) => {
      const pane = map.createPane(paneName);
      pane.style.zIndex = String(zIndex);
      pane.style.pointerEvents = paneName === MAP_PANES.labels ? 'none' : 'auto';
    });

    // Rendering hierarchy:
    // Base map → state outline → county polygons → county borders → operational areas
    // → drive radii → gap/engagement overlays → markers → labels → highlights.
    stateBoundaryRef.current = L.layerGroup().addTo(map);
    countyFillRef.current = L.layerGroup().addTo(map);
    utilizationRef.current = L.layerGroup().addTo(map);
    countyBorderRef.current = L.layerGroup().addTo(map);
    coverageGreyRef.current = L.layerGroup().addTo(map);
    operationalCoverageRef.current = L.layerGroup().addTo(map);
    radiusRef.current = L.layerGroup().addTo(map);
    gapsRef.current = L.layerGroup().addTo(map);
    engagementGapRef.current = L.layerGroup().addTo(map);
    serviceNetworkRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    fteCapacityRef.current = L.layerGroup().addTo(map);
    labelsRef.current = L.layerGroup().addTo(map);
    engagementGapLabelRef.current = L.layerGroup().addTo(map);
    highlightsRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setMapReady(true);

    map.on('click', () => onMapClickRef.current?.());

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
      });

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
        L.DomEvent.stopPropagation(e as any);
        onEntityClickRef.current?.({ type: 'county', county: county.name });
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
          color: hsl(240, 5%, 55%);
          white-space: nowrap;
          pointer-events: none;
          text-shadow: 0 0 4px white, 0 0 4px white;
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
  }, [clearCountyHoverPreview, layers.counties, updateCountyHoverPreview]);

  useEffect(() => {
    if (!DEBUG_ENABLED || !mapRef.current || !mapReady) return;

    DEBUG_LAYER_DEFINITIONS.forEach((definition) => {
      const group = layerGroups[definition.id as keyof typeof layerGroups];
      if (!group) return;

      const shouldAttach = !debugOpen || isLayerVisibleInDebug(definition);
      if (shouldAttach && !mapRef.current!.hasLayer(group)) {
        group.addTo(mapRef.current!);
      }
      if (!shouldAttach && mapRef.current!.hasLayer(group)) {
        mapRef.current!.removeLayer(group);
      }
    });
  }, [debugOpen, isLayerVisibleInDebug, layerGroups, mapReady]);

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

  // Draw Service Network markers
  useEffect(() => {
    if (!serviceNetworkRef.current) return;
    serviceNetworkRef.current.clearLayers();

    if (!layers.services) return;

    const locationCounts = new Map<string, number>();

    filteredRuralServices.forEach((service) => {
      const key = `${service.lat.toFixed(4)},${service.lng.toFixed(4)}`;
      const count = locationCounts.get(key) ?? 0;
      locationCounts.set(key, count + 1);

      const offsetLat = count * 0.0025;
      const offsetLng = count * 0.0025;

      const marker = L.circleMarker([service.lat + offsetLat, service.lng + offsetLng], {
        pane: MAP_PANES.facilityMarkers,
        radius: 4.5,
        color: 'hsl(var(--primary-foreground))',
        weight: 1.5,
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 0.95,
      });

      const countyServices = ruralServicesByCounty.get(service.county) ?? [service];

      marker.on('mouseover', () => {
        onEntityHoverRef.current?.({ type: 'ruralServiceGroup', county: service.county, services: countyServices });
      });
      marker.on('mouseout', () => {
        onEntityHoverRef.current?.(null);
      });
      marker.on('click', (event: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(event as any);
        onEntityClickRef.current?.({ type: 'ruralServiceGroup', county: service.county, services: countyServices });
      });

      marker.bindTooltip(
        `
          <div style="padding: 8px 12px; font-size: 13px; width: 240px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
            <div style="font-weight: 600; margin-bottom: 2px;">${service.name}</div>
            <div style="color: hsl(240, 4%, 46%); font-size: 11px;">${service.city}, ${service.county} County</div>
            <div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 2px;">${service.category}</div>
          </div>
        `,
        {
          direction: 'top',
          offset: [0, -8],
          className: 'facility-tooltip',
        }
      );

      serviceNetworkRef.current!.addLayer(marker);
    });
  }, [filteredRuralServices, layers.services, ruralServicesByCounty]);

  // Draw coverage radii
  useEffect(() => {
    if (!radiusRef.current) return;
    radiusRef.current.clearLayers();

    if (!coverageRadius) return;

    const visibleFacilities = topProvidersOnly
      ? filteredFacilities.filter(f => isTopProvider(f.name))
      : filteredFacilities;

    visibleFacilities.forEach(facility => {
        const colors = facility.type === 'hospital'
          ? { stroke: 'hsla(0, 72%, 51%, 0.55)', fill: 'hsla(0, 72%, 51%, 0.10)' }
          : { stroke: 'hsla(217, 91%, 60%, 0.38)', fill: 'hsla(217, 91%, 60%, 0.08)' };

        const halo = L.circle([facility.lat, facility.lng], {
          pane: MAP_PANES.driveRadii,
          radius: radiusKm * 1000,
          color: 'hsla(0, 0%, 100%, 0.7)',
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
          dashArray: '10 6',
          interactive: false,
        });
        radiusRef.current!.addLayer(circle);
      });
  }, [filteredFacilities, coverageRadius, radiusKm, topProvidersOnly]);

  // Pin color by facility type
  const PIN_COLORS: Record<string, { bg: string; hover: string; size: number; shape: 'circle' | 'diamond' }> = {
    hospital: { bg: 'hsl(0, 72%, 51%)', hover: 'hsl(0, 72%, 60%)', size: 15, shape: 'circle' },
    clinic:   { bg: 'hsl(217, 91%, 60%)', hover: 'hsl(217, 91%, 70%)', size: 10, shape: 'circle' },
    tier1:    { bg: 'hsl(45, 93%, 47%)', hover: 'hsl(45, 93%, 57%)', size: 11, shape: 'diamond' },
  };

  // Draw service point markers
  useEffect(() => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();

    if (!layers.serviceLocations) return;

    const showUtilization = layers.utilizationIntensity;
    const locationCounts = new Map<string, number>();

    const visibleFacilities = topProvidersOnly
      ? filteredFacilities.filter(f => isTopProvider(f.name))
      : filteredFacilities;

    visibleFacilities.forEach(facility => {
      const key = `${facility.lat.toFixed(4)},${facility.lng.toFixed(4)}`;
      const count = locationCounts.get(key) ?? 0;
      locationCounts.set(key, count + 1);
      const offsetLat = count * 0.003;
      const offsetLng = count * 0.003;

      const pin = PIN_COLORS[facility.type] ?? PIN_COLORS.clinic;
      const util = getFacilityUtilization(facility);
      const validation = facilityValidation.records.get(facility.id);
      const scaledSize = showUtilization && util ? getScaledPinSize(pin.size, util.totalVisits) : pin.size;

      const isHospital = facility.type === 'hospital';
      const isDiamond = pin.shape === 'diamond';
      const validationRing = !facilityValidationMode
        ? ''
        : validation?.confidence === 'verified'
          ? ', 0 0 0 3px hsla(142, 60%, 45%, 0.28)'
          : validation?.confidence === 'manual_review'
            ? ', 0 0 0 3px hsla(0, 72%, 51%, 0.38)'
            : ', 0 0 0 3px hsla(38, 92%, 50%, 0.35)';
      const validationBorder = !facilityValidationMode
        ? '2px solid white'
        : validation?.confidence === 'verified'
          ? '2px solid white'
          : validation?.confidence === 'manual_review'
            ? '2px dashed hsl(0, 72%, 51%)'
            : '2px dashed hsl(38, 92%, 50%)';
      const markerHtml = isDiamond
        ? `<div style="
            width: ${scaledSize}px;
            height: ${scaledSize}px;
            background: ${pin.bg};
            border: ${validationBorder};
            box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.2), 0 1px 4px hsla(0, 0%, 0%, 0.35)${validationRing};
            transform: rotate(45deg);
            cursor: pointer;
            transition: background 150ms ease;
          " onmouseover="this.style.background='${pin.hover}'" onmouseout="this.style.background='${pin.bg}'"></div>`
        : `<div style="
            width: ${scaledSize}px;
            height: ${scaledSize}px;
            border-radius: 50%;
            background: ${pin.bg};
            border: ${validationBorder};
            box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.2), 0 1px 4px hsla(0, 0%, 0%, 0.35)${isHospital ? ', 0 0 6px hsla(0, 72%, 51%, 0.4)' : ''}${validationRing};
            cursor: pointer;
            transition: background 150ms ease;
          " onmouseover="this.style.background='${pin.hover}'" onmouseout="this.style.background='${pin.bg}'"></div>`;

      const icon = L.divIcon({
        className: '',
        html: markerHtml,
        iconSize: [scaledSize, scaledSize],
        iconAnchor: [scaledSize / 2, scaledSize / 2],
      });

      const marker = L.marker([facility.lat + offsetLat, facility.lng + offsetLng], {
        icon,
        pane: MAP_PANES.facilityMarkers,
      });
      marker.on('click', () => {
        onFacilityClick(facility);

        if (!facilityValidationMode || !validation) return;

        const validationHtml = `
          <div style="padding: 8px 12px; font-size: 12px; width: 260px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
            <div style="font-weight: 700; margin-bottom: 4px;">${facility.name}</div>
            <div style="color: hsl(240, 4%, 46%); margin-bottom: 6px;">${facility.type === 'hospital' ? 'Hospital' : 'Clinic / Provider'} · ${facility.county} County</div>
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

      const typeLabel = facility.type === 'hospital' ? 'Hospital' : facility.tier === 'tier1' ? 'Clinic / Provider' : 'Clinic';
      const utilHtml = showUtilization && util
        ? `<div style="border-top: 1px solid hsl(240, 5%, 88%); margin-top: 4px; padding-top: 4px; font-size: 10px; color: hsl(270, 40%, 45%);">
            <div>Members: ${util.totalMembers.toLocaleString()} · Visits: ${util.totalVisits.toLocaleString()}</div>
            <div>Visits/Member: ${util.visitsPerMember} · Rank #${util.rank}</div>
          </div>`
        : '';
      const tooltipContent = `
        <div style="padding: 8px 12px; font-size: 13px; width: 240px; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">
          <div style="font-weight: 600; margin-bottom: 2px;">${facility.name}</div>
          <div style="color: hsl(240, 4%, 46%); font-size: 11px;">${facility.city}, ${facility.county} County</div>
          <div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 2px;">${typeLabel}</div>
          ${utilHtml}
        </div>
      `;
      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -8],
        className: 'facility-tooltip',
      });

      markersRef.current!.addLayer(marker);
    });
  }, [facilityValidation, facilityValidationMode, filteredFacilities, layers.serviceLocations, layers.utilizationIntensity, topProvidersOnly, onFacilityClick]);

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
          L.DomEvent.stopPropagation(e as any);
          onEntityClickRef.current?.({ type: 'coverageGap', radiusKm });
        });
        gapsRef.current.addLayer(geoLayer);
      }
    } catch (e) {
      console.error('Coverage gap calculation error:', e);
    }
  }, [facilities, coverageGaps, radiusKm]);

  // ── Grey overlay for non-same-day areas + Operational Coverage Model ──
  useEffect(() => {
    if (!operationalCoverageRef.current || !coverageGreyRef.current) return;
    operationalCoverageRef.current.clearLayers();
    coverageGreyRef.current.clearLayers();

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
  }, [activeCoverageZone, layers.operationalCoverage, coverageGaps]);

  // ── FTE Capacity hub indicators ──
  useEffect(() => {
    if (!fteCapacityRef.current) return;
    fteCapacityRef.current.clearLayers();

    if (!layers.fteCapacity) return;

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
        L.DomEvent.stopPropagation(e as any);
        onFteHubClickRef.current?.(fte.id);
      });
      fteCapacityRef.current!.addLayer(marker);
    });
  }, [layers.fteCapacity, selectedFteId]);

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
        L.DomEvent.stopPropagation(e as any);
        const memberCount = memberVolumeData.find(entry => entry.county === county.name)?.memberCount ?? util.totalMembers;
        onEntityClickRef.current?.({ type: 'memberVolume', county: county.name, memberCount });
      });
      utilizationRef.current!.addLayer(geoLayer);
    });
  }, [layers.utilizationIntensity, coverageGaps, clearCountyHoverPreview, updateCountyHoverPreview]);

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
        L.DomEvent.stopPropagation(event as any);
        onEntityClickRef.current?.({ type: 'county', county: metrics.county });
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
        L.DomEvent.stopPropagation(event as any);
        onEntityClickRef.current?.({ type: 'county', county: result.county });
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
  }, [clearCountyHoverPreview, engagementPriorityCounties, layers.engagementGap, maxPriorityUnengagedMembers, updateCountyHoverPreview]);


  return (
    <div className="relative h-full w-full" data-tutorial="map-region">
      <div ref={containerRef} className="h-full w-full" />
      <TooltipProvider delayDuration={120}>
        {countyHoverPreview && countyHoverPreviewStyle && (
          <div
            className="pointer-events-none absolute z-[1100] rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur-sm"
            style={countyHoverPreviewStyle}
          >
            <p className="text-sm font-semibold text-foreground">{getCountyDisplayName(countyHoverPreview.county)}</p>
            <div className="mt-2 space-y-1">
              {typeof countyHoverPreview.unengagedMembers === 'number' && (
                <CountyHoverMetricRow label="Unengaged members" value={numberFormatter.format(countyHoverPreview.unengagedMembers)} emphasize />
              )}
              {typeof countyHoverPreview.providerCount === 'number' && (
                <CountyHoverMetricRow label="Providers" value={numberFormatter.format(countyHoverPreview.providerCount)} />
              )}
              {typeof countyHoverPreview.coverageGapPercent === 'number' && (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-[11px] leading-relaxed">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      Coverage gap
                      <CoverageGapInfoButton />
                    </span>
                    <span className="text-right font-medium tabular-nums text-foreground/85">{countyHoverPreview.coverageGapPercent}%</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Status: {getCoverageGapSeverity(countyHoverPreview.coverageGapPercent)} coverage gap
                  </div>
                </div>
              )}
            </div>
            <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
              Consider outreach or resource expansion.
            </p>
          </div>
        )}
      </TooltipProvider>
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
