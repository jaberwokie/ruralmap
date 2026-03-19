import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Facility } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import { RuralService } from '@/data/rural-services';
import { MapEntity } from '@/components/map/CoverageDetailPanel';
import { getActiveCoverageZone } from '@/utils/coverageZones';
import { fteCapacityData, getLoadStatus, LOAD_STATUS_COLORS, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { getCountyUtilization, getUtilizationTier, UTILIZATION_COLORS, getFacilityUtilization, getScaledPinSize, isTopProvider, getEngagementGapCounties } from '@/utils/utilizationAggregation';
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
    ruralServices: boolean;
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
  ruralServices?: RuralService[];
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


const MapView = ({ facilities, layers, onFacilityClick, onMapClick, searchQuery, radiusKm, coverageRadius, coverageGaps, ruralServices: ruralServicesData, onEntityClick, onEntityHover, selectedCounty, onFteHubClick, selectedFteId, coverageRadiusKm = 120, topProvidersOnly = false }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const countiesRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const gapsRef = useRef<L.LayerGroup | null>(null);
  const stateBoundaryRef = useRef<L.LayerGroup | null>(null);
  const ruralServicesRef = useRef<L.LayerGroup | null>(null);
  const operationalCoverageRef = useRef<L.LayerGroup | null>(null);
  const fteCapacityRef = useRef<L.LayerGroup | null>(null);
  const utilizationRef = useRef<L.LayerGroup | null>(null);
  const engagementGapRef = useRef<L.LayerGroup | null>(null);
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

    // Create layers in visual stacking order (bottom to top)
    stateBoundaryRef.current = L.layerGroup().addTo(map);       // 0. State boundary
    utilizationRef.current = L.layerGroup().addTo(map);         // 1.3 Utilization intensity
    operationalCoverageRef.current = L.layerGroup().addTo(map); // 1.5 Operational coverage
    countiesRef.current = L.layerGroup().addTo(map);            // 2. County boundaries
    engagementGapRef.current = L.layerGroup().addTo(map);       // 3. Engagement gap outlines
    labelsRef.current = L.layerGroup().addTo(map);              // 4. County labels
    gapsRef.current = L.layerGroup().addTo(map);                // 5. Coverage gaps
    radiusRef.current = L.layerGroup().addTo(map);              // 6. Coverage radii
    ruralServicesRef.current = L.layerGroup().addTo(map);       // 7. Rural service pins
    markersRef.current = L.layerGroup().addTo(map);             // 8. Facility markers
    fteCapacityRef.current = L.layerGroup().addTo(map);          // 9. FTE hub indicators (top)

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

    const geoLayer = L.geoJSON(
      { type: "Feature", geometry: nevadaBoundaryGeoJSON, properties: {} } as GeoJSON.Feature,
      {
        style: {
          color: 'hsl(240, 5%, 55%)',
          weight: 2,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false,
        },
      }
    );
    stateBoundaryRef.current.addLayer(geoLayer);
  }, []);

  // Update county boundary visibility
  useEffect(() => {
    if (!countiesRef.current) return;
    countiesRef.current.clearLayers();
    labelsRef.current?.clearLayers();
    if (!layers.counties) return;

    const nevadaClip = {
      type: "Feature" as const,
      properties: {},
      geometry: nevadaBoundaryGeoJSON,
    };

    nevadaCounties.forEach(county => {
      

      const merged = mergePolygons([county.boundaries]);
      if (!merged) return;
      const clipped = clipPolygon(merged, nevadaClip as any);
      if (!clipped) return;

      const isSelected = selectedCounty === county.name;

      const geoLayer = L.geoJSON(clipped, {
        style: {
          color: isSelected ? 'hsl(200, 60%, 50%)' : 'hsl(240, 5%, 75%)',
          weight: isSelected ? 2.5 : 1,
          fillColor: isSelected ? 'hsla(200, 60%, 50%, 0.08)' : 'transparent',
          fillOpacity: isSelected ? 1 : 0,
          dashArray: isSelected ? undefined : '4 4',
        },
      });

      // Subtle hover cue only — no informational output
      geoLayer.on('mouseover', () => {
        if (!isSelected) {
          geoLayer.setStyle({ color: 'hsl(200, 40%, 65%)', weight: 1.5 });
        }
      });
      geoLayer.on('mouseout', () => {
        if (!isSelected) {
          geoLayer.setStyle({ color: 'hsl(240, 5%, 75%)', weight: 1 });
        }
      });
      geoLayer.on('click', (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e as any);
        const countyServices = ruralServicesData?.filter(s => s.county === county.name) ?? [];
        if (countyServices.length > 0) {
          onEntityClickRef.current?.({ type: 'ruralServiceGroup', county: county.name, services: countyServices });
        } else {
          onEntityClickRef.current?.({ type: 'county', county: county.name });
        }
      });

      countiesRef.current!.addLayer(geoLayer);

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
      L.marker(county.center, { icon: label, interactive: false }).addTo(labelsRef.current!);
    });
  }, [layers.counties, selectedCounty, ruralServicesData]);

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
          radius: radiusKm * 1000,
          color: 'hsla(0, 0%, 100%, 0.7)',
          weight: 4,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false,
        });
        radiusRef.current!.addLayer(halo);

        const circle = L.circle([facility.lat, facility.lng], {
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

      const marker = L.marker([facility.lat + offsetLat, facility.lng + offsetLng], { icon });
      marker.on('click', () => onFacilityClick(facility));

      const typeLabel = facility.type === 'tier1' ? 'Tier 1 Provider' : facility.type === 'hospital' ? 'Hospital' : 'Clinic';
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

    const eligibleFacilities = facilities.filter(f => f.type === 'hospital' || f.type === 'clinic');

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

      let mergedCoverage: Feature<Polygon | MultiPolygon> = buffers[0];
      for (let i = 1; i < buffers.length; i++) {
        const fc = featureCollection([mergedCoverage, buffers[i]]);
        const u = union(fc as any);
        if (u) mergedCoverage = u as Feature<Polygon | MultiPolygon>;
      }

      const fc = featureCollection([analysisFeature, mergedCoverage]);
      const gapGeometry = difference(fc as any);

      if (gapGeometry) {
        const geoLayer = L.geoJSON(gapGeometry as any, {
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
  }, [facilities, coverageGaps, coverageRadius, radiusKm]);

  // ── Operational Coverage Model layer (FTE-centered drive-time zones) ──
  useEffect(() => {
    if (!operationalCoverageRef.current) return;
    operationalCoverageRef.current.clearLayers();

    if (!layers.operationalCoverage) return;

    const activeZone = getActiveCoverageZone(coverageRadiusKm);
    if (!activeZone) return;

    // Active field coverage — continuous merged zone from all field FTEs
    const activeLayer = L.geoJSON(activeZone, {
      style: {
        color: 'hsla(174, 50%, 40%, 0.30)',
        weight: 1.5,
        fillColor: 'hsla(174, 50%, 45%, 0.14)',
        fillOpacity: 1,
      },
      interactive: false,
    });
    operationalCoverageRef.current.addLayer(activeLayer);

    // Scheduled outreach zone — Nevada minus active coverage
    try {
      const nevadaFeat: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: nevadaBoundaryGeoJSON };
      const fc = featureCollection([nevadaFeat, activeZone]);
      const scheduled = difference(fc as any);
      if (scheduled) {
        const scheduledLayer = L.geoJSON(scheduled as any, {
          style: {
            color: 'hsla(174, 40%, 50%, 0.22)',
            weight: 1.5,
            fillColor: 'hsla(174, 40%, 55%, 0.07)',
            fillOpacity: 1,
            dashArray: '8 5',
          },
          interactive: false,
        });
        operationalCoverageRef.current.addLayer(scheduledLayer);
      }
    } catch (e) {
      console.error('Scheduled zone computation error:', e);
    }
  }, [layers.operationalCoverage, coverageRadiusKm]);

  // ── FTE Capacity hub indicators ──
  useEffect(() => {
    if (!fteCapacityRef.current) return;
    fteCapacityRef.current.clearLayers();

    if (!layers.fteCapacity) return;

    fteCapacityData.forEach(fte => {
      if (!fte.hubLocation) return;

      const status = getLoadStatus(fte.currentLoad, fte.capacity);
      const statusDot = LOAD_STATUS_COLORS[status].dot;
      const roleColor = FTE_ROLE_COLORS[fte.id]?.primary ?? 'hsl(0,0%,50%)';
      const isSelected = selectedFteId === fte.id;

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
          <span style="font-size:9px;color:hsl(0,0%,50%);">${fte.currentLoad}/${fte.capacity}</span>
          <div style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:${statusDot};border:1.5px solid white;"></div>
        </div>`,
        iconSize: [150, 28],
        iconAnchor: [0, 14],
      });

      const marker = L.marker([fte.hubLocation.lat, fte.hubLocation.lng], { icon, interactive: true, zIndexOffset: 1000 });
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
    if (!layers.utilizationIntensity) return;

    nevadaCounties.forEach(county => {
      const util = getCountyUtilization(county.name);
      const tier = getUtilizationTier(util.avgVisitsPerMember);
      const colors = UTILIZATION_COLORS[tier];

      const merged = mergePolygons([county.boundaries]);
      if (!merged) return;
      const nevadaClip = { type: "Feature" as const, properties: {}, geometry: nevadaBoundaryGeoJSON };
      const clipped = clipPolygon(merged, nevadaClip as any);
      if (!clipped) return;

      const geoLayer = L.geoJSON(clipped, {
        style: {
          color: colors.border,
          weight: 1,
          fillColor: colors.fill,
          fillOpacity: 1,
        },
      });
      geoLayer.on('click', (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e as any);
        onEntityClickRef.current?.({ type: 'county', county: county.name });
      });
      utilizationRef.current!.addLayer(geoLayer);
    });
  }, [layers.utilizationIntensity]);

  // ── Engagement Gap county outlines (orange) ──
  useEffect(() => {
    if (!engagementGapRef.current) return;
    engagementGapRef.current.clearLayers();
    if (!layers.engagementGap) return;

    const gapCounties = getEngagementGapCounties();

    nevadaCounties.forEach(county => {
      if (!gapCounties.includes(county.name)) return;

      const merged = mergePolygons([county.boundaries]);
      if (!merged) return;
      const nevadaClip = { type: "Feature" as const, properties: {}, geometry: nevadaBoundaryGeoJSON };
      const clipped = clipPolygon(merged, nevadaClip as any);
      if (!clipped) return;

      const geoLayer = L.geoJSON(clipped, {
        style: {
          color: 'hsl(30, 90%, 50%)',
          weight: 2.5,
          fillColor: 'transparent',
          fillOpacity: 0,
          dashArray: '6 3',
        },
        interactive: false,
      });
      engagementGapRef.current!.addLayer(geoLayer);

      // Warning icon at county center
      const warnIcon = L.divIcon({
        className: '',
        html: `<div style="font-size:14px;text-shadow:0 0 3px white,0 0 3px white;" title="Engagement Gap: High utilization, no field support">⚠</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(county.center, { icon: warnIcon, interactive: false }).addTo(engagementGapRef.current!);
    });
  }, [layers.engagementGap]);

  const zoomRef = useRef(7);
  useEffect(() => {
    if (!mapRef.current) return;
    const onZoom = () => {
      const newZoom = mapRef.current!.getZoom();
      const crossed = (zoomRef.current < 6 && newZoom >= 6) || (zoomRef.current >= 6 && newZoom < 6);
      zoomRef.current = newZoom;
      if (crossed && layers.ruralServices) {
        mapRef.current!.fire('rural-redraw');
      }
    };
    mapRef.current.on('zoomend', onZoom);
    return () => { mapRef.current?.off('zoomend', onZoom); };
  }, [layers.ruralServices]);

  // Draw rural services pins
  const drawRuralServices = () => {
    if (!ruralServicesRef.current || !mapRef.current) return;
    ruralServicesRef.current.clearLayers();
    if (!layers.ruralServices || !ruralServicesData?.length) return;

    const zoom = mapRef.current.getZoom();

    if (zoom < 6) {
      const countyCounts = new Map<string, { count: number; lat: number; lng: number }>();
      ruralServicesData.forEach(s => {
        const existing = countyCounts.get(s.county);
        if (existing) { existing.count++; } else {
          const cd = nevadaCounties.find(c => c.name === s.county);
          countyCounts.set(s.county, { count: 1, lat: cd?.center[0] ?? s.lat, lng: cd?.center[1] ?? s.lng });
        }
      });
      countyCounts.forEach((data, county) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;border-radius:50%;background:hsla(200,15%,46%,0.75);color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:1.5px solid white;box-shadow:0 1px 3px hsla(0,0%,0%,0.2);cursor:pointer;">${data.count}</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
        const marker = L.marker([data.lat, data.lng], { icon });
        marker.bindTooltip(`<div style="padding:6px 10px;font-size:12px;"><div style="font-weight:600;">${county} County</div><div style="color:hsl(240,4%,46%);font-size:11px;">${data.count} rural services</div></div>`, { direction: 'top', offset: [0, -16], className: 'facility-tooltip' });
        marker.on('click', () => {
          const countyServices = ruralServicesData?.filter(s => s.county === county) ?? [];
          onEntityClickRef.current?.({ type: 'ruralServiceGroup', county, services: countyServices });
        });
        ruralServicesRef.current!.addLayer(marker);
      });
    } else {
      ruralServicesData.forEach(service => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:6px;height:6px;border-radius:50%;background:hsla(200,15%,46%,0.7);border:1px solid white;box-shadow:0 0 0 1px hsla(0,0%,0%,0.1),0 1px 2px hsla(0,0%,0%,0.15);cursor:pointer;"></div>`,
          iconSize: [6, 6], iconAnchor: [3, 3],
        });
        const marker = L.marker([service.lat, service.lng], { icon });
        const phoneHtml = service.phone ? `<div style="margin-top:2px;"><a href="tel:${service.phone.replace(/[^\d+]/g, '')}" style="color:hsl(217,91%,60%);font-size:10px;">${service.phone}</a></div>` : '';
        marker.bindTooltip(`<div style="padding:8px 12px;font-size:13px;width:240px;white-space:normal;word-break:break-word;overflow-wrap:anywhere;"><div style="font-weight:600;margin-bottom:2px;">${service.name}</div><div style="color:hsl(200,15%,46%);font-size:10px;margin-bottom:2px;">${service.category}</div><div style="color:hsl(240,4%,46%);font-size:11px;">${service.city}, ${service.county} Co.</div>${service.address ? `<div style="color:hsl(240,4%,46%);font-size:10px;margin-top:2px;">${service.address}</div>` : ''}${phoneHtml}</div>`, { direction: 'top', offset: [0, -6], className: 'facility-tooltip' });
        marker.on('click', () => {
          const countyServices = ruralServicesData?.filter(s => s.county === service.county) ?? [];
          onEntityClickRef.current?.({ type: 'ruralServiceGroup', county: service.county, services: countyServices });
        });
        ruralServicesRef.current!.addLayer(marker);
      });
    }
  };

  useEffect(() => {
    drawRuralServices();
    if (!mapRef.current) return;
    const redraw = () => drawRuralServices();
    mapRef.current.on('rural-redraw', redraw);
    return () => { mapRef.current?.off('rural-redraw', redraw); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.ruralServices, ruralServicesData]);

  // Coverage gaps "Limited Services" labels
  useEffect(() => {
    if (!coverageGaps || !layers.ruralServices || !ruralServicesData?.length || !gapsRef.current) return;

    const serviceCounts = new Map<string, number>();
    ruralServicesData.forEach(s => serviceCounts.set(s.county, (serviceCounts.get(s.county) ?? 0) + 1));

    nevadaCounties.forEach(county => {
      const count = serviceCounts.get(county.name) ?? 0;
      if (count <= 3) {
        const label = L.divIcon({
          className: '',
          html: `<span style="
            font-size:9px; font-weight:600; color:hsla(0,72%,45%,0.7);
            white-space:nowrap; pointer-events:none;
            text-shadow:0 0 3px white,0 0 3px white;
            font-style:italic;
          ">Limited Services</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, -8],
        });
        L.marker([county.center[0] - 0.15, county.center[1]], { icon: label, interactive: false }).addTo(gapsRef.current!);
      }
    });
  }, [coverageGaps, layers.ruralServices, ruralServicesData]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default MapView;
