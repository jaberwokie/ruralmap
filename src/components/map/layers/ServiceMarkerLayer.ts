import L from 'leaflet';
import type { RuralService } from '@/data/rural-services';
import { MAP_PIN_VISUALS, getSharedPinSvgMarkup } from '@/components/map/pinVisuals';
import type {
  ProviderMapPointMarker,
  ProviderPointSelectionEntity,
} from '@/components/map/layers/ProviderMarkerLayer';
import type { MapEntity } from '@/types/entities';

interface MarkerHoverPreview {
  name: string;
  subtitle?: string;
  address?: string;
  detail?: string;
  extraHtml?: string;
  memberDistanceMi?: number;
  memberTierLabel?: string;
}

interface ServiceValidationLike {
  records: Map<string, { confidence: string }>;
}

interface RenderServiceMarkersOptions {
  services: RuralService[];
  displayCoordinates: Map<string, [number, number]>;
  servicePresencePane: string;
  baseZIndexOffset: number;
  serviceValidation: ServiceValidationLike;
  applyMarkerPriority: (marker: ProviderMapPointMarker, state: 'default' | 'selected') => void;
  selectMarkerEntity: (
    entity: ProviderPointSelectionEntity | undefined,
    source: string,
    event: L.LeafletEvent,
    marker: ProviderMapPointMarker,
  ) => void;
  selectMarkerEntityRef: {
    current: (
      entity: ProviderPointSelectionEntity | undefined,
      source: string,
      event: L.LeafletEvent | Event | null,
      marker: ProviderMapPointMarker,
    ) => void;
  };
  getMemberDistanceInfo: (lat: number, lng: number) => { memberDistanceMi: number; memberTierLabel: string } | null;
  markerHoverPreviewRef: { current: (preview: MarkerHoverPreview | null) => void };
  logMapSelectionDebug: (phase: string, entity?: MapEntity | null, extra?: Record<string, unknown>) => void;
  cluster: { addLayer: (layer: L.Layer) => void };
}

export function renderServiceMarkers({
  services,
  displayCoordinates,
  servicePresencePane,
  baseZIndexOffset,
  serviceValidation,
  applyMarkerPriority,
  selectMarkerEntity,
  selectMarkerEntityRef,
  getMemberDistanceInfo,
  markerHoverPreviewRef,
  logMapSelectionDebug,
  cluster,
}: RenderServiceMarkersOptions) {
  const markerSize = MAP_PIN_VISUALS.servicePresence.size;
  const hitSize = Math.max(markerSize, 28);
  const servicePresenceIcon = L.divIcon({
    className: '',
    html: getSharedPinSvgMarkup('servicePresence', markerSize),
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitSize / 2, hitSize],
    tooltipAnchor: [0, -hitSize],
  });

  services.forEach((service) => {
    const [displayLat, displayLng] = displayCoordinates.get(`service:${service.id}`) ?? [service.lat, service.lng];

    const marker = L.marker([displayLat, displayLng], {
      icon: servicePresenceIcon,
      pane: servicePresencePane,
      zIndexOffset: baseZIndexOffset,
    }) as ProviderMapPointMarker;

    marker.__pointKind = 'servicePresence';
    marker.__baseZIndexOffset = baseZIndexOffset;
    marker.__entity = { type: 'ruralService', service };
    marker.__entityType = 'ruralService';
    marker.__entityId = service.id;
    marker.__entityName = service.name;
    applyMarkerPriority(marker, 'default');
    // Reduce opacity for approximate/city-center pins
    const svcValidation = serviceValidation.records.get(service.id);
    if (svcValidation && svcValidation.confidence !== 'verified') {
      marker.setOpacity(0.82);
    }
    logMapSelectionDebug('marker-rendered', marker.__entity, { source: 'service-marker', pointKind: marker.__pointKind });

    // No hover interaction for pins — click only
    marker.on('click', (event: L.LeafletEvent) => {
      selectMarkerEntity(marker.__entity as ProviderPointSelectionEntity | undefined, 'service-marker', event, marker);
    });

    // Native DOM click backup — same pattern as provider markers
    marker.once('add', () => {
      const iconEl = marker.getElement?.();
      if (iconEl) {
        iconEl.addEventListener('click', (nativeEvent: MouseEvent) => {
          nativeEvent.stopPropagation();
          logMapSelectionDebug('native-dom-click', marker.__entity, { source: 'service-marker-native' });
          selectMarkerEntityRef.current(marker.__entity as ProviderPointSelectionEntity | undefined, 'service-marker-native', null, marker);
        });
      }
    });

    marker.on('mouseover', () => {
      const distInfo = getMemberDistanceInfo(service.lat, service.lng);
      markerHoverPreviewRef.current({
        name: service.name,
        subtitle: `${service.city}, ${service.county} County`,
        address: service.address,
        detail: service.category,
        ...distInfo,
      });
    });
    marker.on('mouseout', () => markerHoverPreviewRef.current(null));

    // Add to MarkerClusterGroup — same click interception path as providers.
    // The cluster group's on('click') handler catches all child marker clicks
    // reliably, matching the provider interaction contract.
    cluster.addLayer(marker);
  });
}
