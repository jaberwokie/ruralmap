import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Facility } from '@/data/facilities';
import { nevadaCounties, CoverageArea, COVERAGE_AREA_LABELS, getCountyArea } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { mergePolygons, clipPolygon } from '@/utils/mergePolygons';
import { nevadaBoundaryGeoJSON } from '@/data/nevada-boundary';
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import union from '@turf/union';
import { point as turfPoint, featureCollection, polygon as turfPolygon } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

interface MapViewProps {
  facilities: Facility[];
  layers: {
    counties: boolean;
    zones: boolean;
    serviceLocations: boolean;
    memberVolume: boolean;
  };
  onFacilityClick: (facility: Facility) => void;
  onAreaHover?: (area: CoverageArea | null) => void;
  onAreaClick?: (area: CoverageArea) => void;
  focusedArea?: CoverageArea | null;
  searchQuery: string;
  radiusKm: number;
  coverageRadius: boolean;
  coverageGaps: boolean;
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

const AREA_FILL: Record<CoverageArea, { fill: string; border: string; weight: number }> = {
  area1: { fill: 'hsla(142, 71%, 45%, 0.38)', border: 'hsla(142, 71%, 45%, 0.65)', weight: 2.5 },
  area2: { fill: 'hsla(35, 92%, 50%, 0.28)', border: 'hsla(35, 92%, 50%, 0.50)', weight: 2 },
  area3: { fill: 'hsla(217, 91%, 60%, 0.18)', border: 'hsla(217, 91%, 60%, 0.40)', weight: 2 },
};

const AREA_RADIUS_COLORS: Record<CoverageArea, { stroke: string; fill: string }> = {
  area1: { stroke: 'hsla(142, 71%, 45%, 0.18)', fill: 'hsla(142, 71%, 45%, 0.03)' },
  area2: { stroke: 'hsla(35, 92%, 50%, 0.18)', fill: 'hsla(35, 92%, 50%, 0.03)' },
  area3: { stroke: 'hsla(217, 91%, 60%, 0.18)', fill: 'hsla(217, 91%, 60%, 0.03)' },
};

const MapView = ({ facilities, layers, onFacilityClick, onAreaHover, onAreaClick, focusedArea, searchQuery, radiusKm, coverageRadius, coverageGaps }: MapViewProps) => {
  const prevFocusedAreaRef = useRef<CoverageArea | null | undefined>(undefined);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const countiesRef = useRef<L.LayerGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const gapsRef = useRef<L.LayerGroup | null>(null);
  const memberVolumeRef = useRef<L.LayerGroup | null>(null);
  const stateBoundaryRef = useRef<L.LayerGroup | null>(null);
  const onAreaClickRef = useRef(onAreaClick);
  onAreaClickRef.current = onAreaClick;

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

  // Initialize map — layer order: base → zones → counties → radii → gaps → volume → markers
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
    stateBoundaryRef.current = L.layerGroup().addTo(map); // 0. State boundary
    zonesRef.current = L.layerGroup().addTo(map);         // 1. Coverage areas
    countiesRef.current = L.layerGroup().addTo(map);      // 2. County boundaries
    labelsRef.current = L.layerGroup().addTo(map);        // 3. County labels
    radiusRef.current = L.layerGroup().addTo(map);        // 4. Coverage radii
    gapsRef.current = L.layerGroup().addTo(map);          // 5. Coverage gaps
    memberVolumeRef.current = L.layerGroup().addTo(map);  // 6. Member volume
    markersRef.current = L.layerGroup().addTo(map);       // 7. Service points (top)

    mapRef.current = map;

    // Click on empty map space clears focus
    map.on('click', () => onAreaClickRef.current?.(null as any));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw state boundary (always visible, non-interactive)
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

  // County drawing is handled by the focus-aware effect below

  // Draw merged coverage area overlays
  useEffect(() => {
    if (!zonesRef.current) return;
    zonesRef.current.clearLayers();

    if (!layers.zones) return;

    const volumeMap = new Map(memberVolumeData.map(d => [d.county, d.memberCount]));
    const areas: CoverageArea[] = ['area1', 'area2', 'area3'];

    const nevadaClip = {
      type: "Feature" as const,
      properties: {},
      geometry: nevadaBoundaryGeoJSON,
    };

    areas.forEach(area => {
      // Skip non-focused areas entirely when a focus is active
      if (focusedArea && area !== focusedArea) return;

      const counties = nevadaCounties.filter(c => c.zone === area);
      const merged = mergePolygons(counties.map(c => c.boundaries));
      if (!merged) return;

      const clipped = clipPolygon(merged, nevadaClip as any);
      if (!clipped) return;

      const baseColors = AREA_FILL[area];

      // When focused, emphasize; otherwise use base colors
      let fillColor = baseColors.fill;
      let borderColor = baseColors.border;
      let weight = baseColors.weight;

      if (focusedArea && area === focusedArea) {
        fillColor = baseColors.fill.replace(/[\d.]+\)$/, '0.55)');
        borderColor = baseColors.border.replace(/[\d.]+\)$/, '0.85)');
        weight = baseColors.weight + 1.5;
      }

      const geoLayer = L.geoJSON(clipped, {
        style: {
          color: borderColor,
          weight,
          fillColor,
          fillOpacity: 1,
          dashArray: '6 4',
        },
      });

      geoLayer.on({
        mouseover: () => onAreaHover?.(area),
        mouseout: () => onAreaHover?.(null),
        click: (e: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(e as any);
          onAreaClick?.(area);
        },
      });

      zonesRef.current!.addLayer(geoLayer);
    });
  }, [layers.zones, onAreaHover, onAreaClick, focusedArea]);

  // Update county boundary visibility based on focus
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
      // Skip counties not in focused area
      if (focusedArea && county.zone !== focusedArea) return;

      const merged = mergePolygons([county.boundaries]);
      if (!merged) return;
      const clipped = clipPolygon(merged, nevadaClip as any);
      if (!clipped) return;

      const geoLayer = L.geoJSON(clipped, {
        style: {
          color: 'hsl(240, 5%, 75%)',
          weight: 1,
          fillColor: 'transparent',
          fillOpacity: 0,
          dashArray: '4 4',
        },
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
  }, [focusedArea, layers.counties]);

  // Draw coverage radii (dashed, area-colored)
  useEffect(() => {
    if (!radiusRef.current) return;
    radiusRef.current.clearLayers();

    if (!coverageRadius) return;

    filteredFacilities
      .filter(f => f.type === 'hospital')
      .forEach(facility => {
        const area = getCountyArea(facility.county);
        const colors = AREA_RADIUS_COLORS[area];
        const circle = L.circle([facility.lat, facility.lng], {
          radius: radiusKm * 1000,
          color: colors.stroke,
          weight: 1,
          fillColor: colors.fill,
          fillOpacity: 1,
          dashArray: '8 6',
        });
        radiusRef.current!.addLayer(circle);
      });
  }, [filteredFacilities, coverageRadius, radiusKm]);

  // Pin color by facility type (independent of coverage areas)
  const PIN_COLORS: Record<string, { bg: string; hover: string; size: number; shape: 'circle' | 'diamond' }> = {
    hospital: { bg: 'hsl(0, 72%, 51%)', hover: 'hsl(0, 72%, 60%)', size: 15, shape: 'circle' },
    clinic:   { bg: 'hsl(217, 91%, 60%)', hover: 'hsl(217, 91%, 70%)', size: 10, shape: 'circle' },
    tier1:    { bg: 'hsl(45, 93%, 47%)', hover: 'hsl(45, 93%, 57%)', size: 11, shape: 'diamond' },
  };

  // Draw service point markers (color-coded by facility type, NOT by coverage area)
  useEffect(() => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();

    if (!layers.serviceLocations) return;

    const locationCounts = new Map<string, number>();

    filteredFacilities.forEach(facility => {
      const key = `${facility.lat.toFixed(4)},${facility.lng.toFixed(4)}`;
      const count = locationCounts.get(key) ?? 0;
      locationCounts.set(key, count + 1);
      const offsetLat = count * 0.003;
      const offsetLng = count * 0.003;

      const pin = PIN_COLORS[facility.type] ?? PIN_COLORS.clinic;

      const isHospital = facility.type === 'hospital';
      const isDiamond = pin.shape === 'diamond';
      const markerHtml = isDiamond
        ? `<div style="
            width: ${pin.size}px;
            height: ${pin.size}px;
            background: ${pin.bg};
            border: 2px solid white;
            box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.2), 0 1px 4px hsla(0, 0%, 0%, 0.35);
            transform: rotate(45deg);
            cursor: pointer;
            transition: background 150ms ease;
          " onmouseover="this.style.background='${pin.hover}'" onmouseout="this.style.background='${pin.bg}'"></div>`
        : `<div style="
            width: ${pin.size}px;
            height: ${pin.size}px;
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
        iconSize: [pin.size, pin.size],
        iconAnchor: [pin.size / 2, pin.size / 2],
      });

      const marker = L.marker([facility.lat + offsetLat, facility.lng + offsetLng], { icon });
      marker.on('click', () => onFacilityClick(facility));

      const typeLabel = facility.type === 'tier1' ? 'Tier 1 Provider' : facility.type === 'hospital' ? 'Hospital' : 'Clinic';
      const tooltipContent = `
        <div style="padding: 8px 12px; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 2px;">${facility.name}</div>
          <div style="color: hsl(240, 4%, 46%); font-size: 11px;">${facility.city}, ${facility.county} County</div>
          <div style="color: hsl(240, 4%, 46%); font-size: 10px; margin-top: 2px;">${typeLabel}</div>
        </div>
      `;
      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -8],
        className: 'facility-tooltip',
      });

      markersRef.current!.addLayer(marker);
    });
  }, [filteredFacilities, layers.serviceLocations, onFacilityClick]);

  // Draw coverage gap overlays using true geometric subtraction
  useEffect(() => {
    if (!gapsRef.current) return;
    gapsRef.current.clearLayers();

    if (!coverageGaps) return;

    // Only hospitals and clinics count (exclude tier1)
    const eligibleFacilities = facilities.filter(f => f.type === 'hospital' || f.type === 'clinic');

    // Build analysis boundary: focused area polygon or full state
    let analysisFeature: Feature<Polygon | MultiPolygon>;
    if (focusedArea) {
      const areaCounties = nevadaCounties.filter(c => c.zone === focusedArea);
      const merged = mergePolygons(areaCounties.map(c => c.boundaries));
      if (!merged) return;
      const nevadaClip = { type: "Feature" as const, properties: {}, geometry: nevadaBoundaryGeoJSON };
      const clipped = clipPolygon(merged, nevadaClip as any);
      analysisFeature = clipped
        ? (clipped as Feature<Polygon | MultiPolygon>)
        : { type: "Feature", properties: {}, geometry: nevadaBoundaryGeoJSON };
    } else {
      analysisFeature = { type: "Feature", properties: {}, geometry: nevadaBoundaryGeoJSON };
    }

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
      // 1. Create radius buffers for each eligible facility and merge
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

      // 2. Subtract merged coverage from analysis boundary
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
        geoLayer.bindTooltip(
          `<div style="padding: 6px 10px; font-size: 12px; font-weight: 600;">Coverage Gap<br/><span style="font-weight: 400; color: hsl(240, 4%, 46%);">No hospital or clinic within ${radiusKm} km</span></div>`,
          { sticky: true, className: 'facility-tooltip' }
        );
        gapsRef.current.addLayer(geoLayer);
      }
    } catch (e) {
      console.error('Coverage gap calculation error:', e);
    }
  }, [facilities, coverageGaps, radiusKm, focusedArea]);

  // Draw member volume choropleth
  useEffect(() => {
    if (!memberVolumeRef.current) return;
    memberVolumeRef.current.clearLayers();

    if (!layers.memberVolume) return;

    const maxCount = Math.max(...memberVolumeData.map(d => d.memberCount));
    const volumeMap = new Map(memberVolumeData.map(d => [d.county, d.memberCount]));

    nevadaCounties.forEach(county => {
      const count = volumeMap.get(county.name) ?? 0;
      const intensity = maxCount > 0 ? count / maxCount : 0;
      const lightness = 92 - intensity * 55;
      const saturation = 40 + intensity * 30;
      const fillColor = `hsl(190, ${saturation}%, ${lightness}%)`;
      const borderColor = `hsl(190, ${saturation + 10}%, ${Math.max(lightness - 15, 20)}%)`;

      const polygon = L.polygon(county.boundaries, {
        color: borderColor,
        weight: 1.5,
        fillColor,
        fillOpacity: 0.75,
      });

      polygon.bindTooltip(
        `<div style="padding: 6px 10px; font-size: 12px;">
          <div style="font-weight: 600; margin-bottom: 2px;">${county.name} County</div>
          <div style="color: hsl(240, 4%, 46%); font-size: 11px;">${count.toLocaleString()} members</div>
        </div>`,
        { sticky: true, className: 'facility-tooltip' }
      );

      memberVolumeRef.current!.addLayer(polygon);
    });
  }, [layers.memberVolume]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default MapView;
