import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Facility } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';

interface MapViewProps {
  facilities: Facility[];
  layers: {
    counties: boolean;
    hospitals: boolean;
    clinics: boolean;
    zones: boolean;
    tier1: boolean;
    radius: boolean;
  };
  onFacilityClick: (facility: Facility) => void;
  searchQuery: string;
}

const ZONE_COLORS = {
  primary: 'hsla(217, 91%, 60%, 0.12)',
  secondary: 'hsla(35, 92%, 50%, 0.08)',
  frontier: 'hsla(240, 5%, 64%, 0.05)',
  none: 'transparent',
};

const ZONE_BORDER_COLORS = {
  primary: 'hsla(217, 91%, 60%, 0.4)',
  secondary: 'hsla(35, 92%, 50%, 0.3)',
  frontier: 'hsla(240, 5%, 64%, 0.2)',
  none: 'hsla(240, 5%, 84%, 0.3)',
};

const MapView = ({ facilities, layers, onFacilityClick, searchQuery }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const countiesRef = useRef<L.LayerGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);

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

    // Use CartoDB Positron for a clean muted base
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    countiesRef.current = L.layerGroup().addTo(map);
    zonesRef.current = L.layerGroup().addTo(map);
    labelsRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw county boundaries
  useEffect(() => {
    if (!countiesRef.current || !labelsRef.current) return;
    countiesRef.current.clearLayers();
    labelsRef.current.clearLayers();

    if (!layers.counties) return;

    nevadaCounties.forEach(county => {
      const polygon = L.polygon(county.boundaries, {
        color: county.isPrimary ? 'hsl(240, 5%, 60%)' : 'hsl(240, 5%, 78%)',
        weight: county.isPrimary ? 2 : 1,
        fillColor: 'transparent',
        fillOpacity: 0,
        dashArray: county.isPrimary ? undefined : '4 4',
      });
      countiesRef.current!.addLayer(polygon);

      // County label
      const label = L.divIcon({
        className: 'county-label',
        html: `<span style="
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: hsl(240, 5%, ${county.isPrimary ? '40%' : '60%'});
          white-space: nowrap;
          pointer-events: none;
          text-shadow: 0 0 4px white, 0 0 4px white;
        ">${county.name}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(county.center, { icon: label, interactive: false }).addTo(labelsRef.current!);
    });
  }, [layers.counties]);

  // Draw zone overlays
  useEffect(() => {
    if (!zonesRef.current) return;
    zonesRef.current.clearLayers();

    if (!layers.zones) return;

    nevadaCounties.forEach(county => {
      if (county.zone === 'none') return;
      const polygon = L.polygon(county.boundaries, {
        color: ZONE_BORDER_COLORS[county.zone],
        weight: 1.5,
        fillColor: ZONE_COLORS[county.zone],
        fillOpacity: 1,
      });
      zonesRef.current!.addLayer(polygon);
    });
  }, [layers.zones]);

  // Draw facility markers
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    filteredFacilities.forEach(facility => {
      if (facility.type === 'hospital' && !layers.hospitals) return;
      if (facility.type === 'clinic' && !layers.clinics) return;
      if (facility.type === 'tier1' && !layers.tier1) return;

      const markerClass = facility.type === 'hospital' ? 'hospital' :
                          facility.type === 'tier1' ? 'tier1' : 'clinic';

      const icon = L.divIcon({
        className: '',
        html: `<div class="facility-marker ${markerClass}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker([facility.lat, facility.lng], { icon });
      marker.on('click', () => onFacilityClick(facility));

      const tooltipContent = `
        <div style="padding: 8px 12px; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 2px;">${facility.name}</div>
          <div style="color: hsl(240, 4%, 46%); font-size: 11px;">${facility.city}, ${facility.county} County</div>
        </div>
      `;
      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -8],
        className: 'facility-tooltip',
      });

      markersRef.current!.addLayer(marker);
    });
  }, [filteredFacilities, layers.hospitals, layers.clinics, layers.tier1, onFacilityClick]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default MapView;
