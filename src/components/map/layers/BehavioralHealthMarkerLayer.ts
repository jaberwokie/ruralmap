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

interface RenderBehavioralHealthMarkersOptions {
  services: RuralService[];
  displayCoordinates: Map<string, [number, number]>;
  behavioralHealthPane: string;
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

export function renderBehavioralHealthMarkers({
  services,
  displayCoordinates,
  behavioralHealthPane,
  baseZIndexOffset,
  serviceValidation,
  applyMarkerPriority,
  selectMarkerEntity,
  selectMarkerEntityRef,
  getMemberDistanceInfo,
  markerHoverPreviewRef,
  logMapSelectionDebug,
  cluster,
}: RenderBehavioralHealthMarkersOptions) {
  const markerSize = MAP_PIN_VISUALS.behavioralHealth.size;
  const hitSize = Math.max(markerSize, 28);
  const behavioralHealthIcon = L.divIcon({
    className: '',
    html: getSharedPinSvgMarkup('behavioralHealth', markerSize),
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitSize / 2, hitSize],
    tooltipAnchor: [0, -hitSize],
  });

  services.forEach((service) => {
    const [displayLat, displayLng] = displayCoordinates.get(`behavioral-health:${service.id}`) ?? [service.lat, service.lng];

    const marker = L.marker([displayLat, displayLng], {
      icon: behavioralHealthIcon,
      pane: behavioralHealthPane,
      zIndexOffset: baseZIndexOffset,
    }) as ProviderMapPointMarker;

    marker.__pointKind = 'behavioralHealth';
    marker.__baseZIndexOffset = baseZIndexOffset;
    marker.__entity = { type: 'ruralService', service };
    marker.__entityType = 'ruralService';
    marker.__entityId = service.id;
    marker.__entityName = service.name;
    applyMarkerPriority(marker, 'default');
    const bhValidation = serviceValidation.records.get(service.id);
    if (bhValidation && bhValidation.confidence !== 'verified') {
      marker.setOpacity(0.82);
    }
    logMapSelectionDebug('marker-rendered', marker.__entity, { source: 'behavioral-health-marker', pointKind: marker.__pointKind });

    // No hover interaction for pins — click only
    marker.on('click', (event: L.LeafletEvent) => {
      selectMarkerEntity(marker.__entity as ProviderPointSelectionEntity | undefined, 'behavioral-health-marker', event, marker);
    });

    // Native DOM click backup — same pattern as provider markers
    marker.once('add', () => {
      const iconEl = marker.getElement?.();
      if (iconEl) {
        iconEl.addEventListener('click', (nativeEvent: MouseEvent) => {
          nativeEvent.stopPropagation();
          logMapSelectionDebug('native-dom-click', marker.__entity, { source: 'behavioral-health-marker-native' });
          selectMarkerEntityRef.current(marker.__entity as ProviderPointSelectionEntity | undefined, 'behavioral-health-marker-native', null, marker);
        });
      }
    });

    marker.on('mouseover', () => {
      const distInfo = getMemberDistanceInfo(service.lat, service.lng);
      markerHoverPreviewRef.current({
        name: service.name,
        subtitle: `${service.city}, ${service.county} County`,
        address: service.address,
        detail: `Behavioral Health · ${service.category}`,
        ...distInfo,
      });
    });
    marker.on('mouseout', () => markerHoverPreviewRef.current(null));

    // Add to MarkerClusterGroup — same click interception path as providers.
    cluster.addLayer(marker);
  });
}
