import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Facility } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import { MapEntity } from '@/components/map/CoverageDetailPanel';
import { getActiveCoverageZone } from '@/utils/coverageZones';
import { fteCapacityData, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { getCountyUtilization, getUtilizationTier, UTILIZATION_COLORS, getFacilityUtilization, getScaledPinSize, isTopProvider, getEngagementGapCounties, getEngagementGapResults, EngagementGapResult, WASHOE_URBAN_RURAL_LAT } from '@/utils/utilizationAggregation';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import union from '@turf/union';
import { point as turfPoint, featureCollection, polygon as turfPolygon } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

interface MapViewProps {
  facilities: Facility[];
  layers: {
    counties: boolean;
    serviceLocations: boolean;
    operationalCoverage: boolean;
    fteCapacity: boolean;
    utilizationIntensity: boolean;
    engagementGap: boolean;
  };
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
}

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

const createGeoJsonLayer = (
  geometry: Feature<Polygon | MultiPolygon> | Feature<Polygon>,
  pane: (typeof MAP_PANES)[keyof typeof MAP_PANES],
  style: L.PathOptions,
  interactive = false,
) => L.geoJSON(geometry as any, { pane, style, interactive });


const MapView = ({ facilities, layers, onFacilityClick, onMapClick, searchQuery, radiusKm, coverageRadius, coverageGaps, onEntityClick, onEntityHover, selectedCounty, onFteHubClick, selectedFteId, coverageRadiusKm = 120, topProvidersOnly = false }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
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
  const highlightsRef = useRef<L.LayerGroup | null>(null);
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
    markersRef.current = L.layerGroup().addTo(map);
    fteCapacityRef.current = L.layerGroup().addTo(map);
    labelsRef.current = L.layerGroup().addTo(map);
    highlightsRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    map.on('click', () => onMapClickRef.current?.());

    return () => {
      map.remove();
      mapRef.current = null;
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

      hitArea.on('mouseover', () => {
        hitArea.setStyle({ fillColor: 'hsla(200, 40%, 65%, 0.06)' });
      });
      hitArea.on('mouseout', () => {
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
  }, [layers.counties]);

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

  // Draw coverage radii
  useEffect(() => {
    if (!radiusRef.current) return;
    radiusRef.current.clearLayers();

    if (!coverageRadius) return;

    filteredFacilities
      .filter(f => f.type === 'hospital')
      .forEach(facility => {
        const colors = RADIUS_COLORS;

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
  }, [filteredFacilities, coverageRadius, radiusKm]);

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
      const scaledSize = showUtilization && util ? getScaledPinSize(pin.size, util.totalVisits) : pin.size;

      const isHospital = facility.type === 'hospital';
      const isDiamond = pin.shape === 'diamond';
      const markerHtml = isDiamond
        ? `<div style="
            width: ${scaledSize}px;
            height: ${scaledSize}px;
            background: ${pin.bg};
            border: 2px solid white;
            box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.2), 0 1px 4px hsla(0, 0%, 0%, 0.35);
            transform: rotate(45deg);
            cursor: pointer;
            transition: background 150ms ease;
          " onmouseover="this.style.background='${pin.hover}'" onmouseout="this.style.background='${pin.bg}'"></div>`
        : `<div style="
            width: ${scaledSize}px;
            height: ${scaledSize}px;
            border-radius: 50%;
            background: ${pin.bg};
            border: 2px solid white;
            box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.2), 0 1px 4px hsla(0, 0%, 0%, 0.35)${isHospital ? ', 0 0 6px hsla(0, 72%, 51%, 0.4)' : ''};
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
      marker.on('click', () => onFacilityClick(facility));

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
  }, [filteredFacilities, layers.serviceLocations, layers.utilizationIntensity, topProvidersOnly, onFacilityClick]);

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

    const activeZone = getActiveCoverageZone(coverageRadiusKm);
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
  }, [layers.operationalCoverage, coverageRadiusKm, coverageGaps]);

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
  }, [layers.utilizationIntensity, coverageGaps]);

  // ── Engagement Gap county outlines (orange = gap, yellow = watchlist) ──
  useEffect(() => {
    if (!engagementGapRef.current) return;
    engagementGapRef.current.clearLayers();
    if (!layers.engagementGap) return;

    const results = getEngagementGapResults();

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
        interactive: false,
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
      L.marker(iconCenter, { icon: warnIcon, interactive: false, pane: MAP_PANES.labels }).addTo(engagementGapRef.current!);
    });
  }, [layers.engagementGap]);


  return <div ref={containerRef} className="w-full h-full" />;
};

export default MapView;
