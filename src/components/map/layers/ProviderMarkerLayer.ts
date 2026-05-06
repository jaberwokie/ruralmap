import L from 'leaflet';
import { Facility, getFacilityClassification, getFacilityDataConfidence, getFacilityTypeLabel } from '@/data/facilities';
import { MAP_PIN_VISUALS, getSharedPinSvgMarkup } from '@/components/map/pinVisuals';
import { getFacilityCoordinateSourceLabel, buildFacilityValidationIndex } from '@/utils/facilityValidation';

type FacilityValidationIndex = ReturnType<typeof buildFacilityValidationIndex>;
import { getFacilityUtilization, getScaledPinSize } from '@/utils/utilizationAggregation';
import { getProviderClaimsMetrics } from '@/utils/providerClaimsMetrics';
import { isPublicSafeModeActive } from '@/hooks/usePublicSafeMode';
import type { MapEntity } from '@/types/entities';

export type ProviderPointMarkerKind =
  keyof Pick<typeof MAP_PIN_VISUALS, 'providerLocations' | 'servicePresence' | 'behavioralHealth'>;

export type ProviderMapPointMarker = L.Marker & {
  __pointKind?: ProviderPointMarkerKind;
  __providerType?: 'hospital' | 'clinic';
  __baseZIndexOffset?: number;
  __priorityState?: 'default' | 'selected';
  __entity?: MapEntity;
  __entityType?: MapEntity['type'];
  __entityId?: string;
  __entityName?: string;
};

export type ProviderPointSelectionEntity = Extract<MapEntity, { type: 'facility' | 'ruralService' }>;

interface MarkerHoverPreview {
  name: string;
  subtitle?: string;
  address?: string;
  detail?: string;
  extraHtml?: string;
  memberDistanceMi?: number;
  memberTierLabel?: string;
}

interface RenderProviderMarkersOptions {
  visibleFacilities: Facility[];
  displayCoordinates: Map<string, [number, number]>;
  mapZoom: number;
  facilityMarkersPane: string;
  baseZIndexOffset: number;
  showUtilization: boolean;
  showTier1Highlight: boolean;
  topProvidersOnly: boolean;
  facilityValidation: FacilityValidationIndex;
  facilityValidationMode: boolean;
  applyMarkerPriority: (marker: ProviderMapPointMarker, state: 'default' | 'selected') => void;
  selectMarkerEntity: (
    entity: ProviderPointSelectionEntity | undefined,
    source: string,
    event: L.LeafletEvent | null,
    marker: ProviderMapPointMarker,
  ) => void;
  getMemberDistanceInfo: (lat: number, lng: number) => { memberDistanceMi: number; memberTierLabel: string } | null;
  markerHoverPreviewRef: { current: (preview: MarkerHoverPreview | null) => void };
  logMapSelectionDebug: (phase: string, entity?: MapEntity | null, extra?: Record<string, unknown>) => void;
}

export function renderProviderMarkers({
  visibleFacilities,
  displayCoordinates,
  mapZoom,
  facilityMarkersPane,
  baseZIndexOffset,
  showUtilization,
  showTier1Highlight,
  topProvidersOnly,
  facilityValidation,
  facilityValidationMode,
  applyMarkerPriority,
  selectMarkerEntity,
  getMemberDistanceInfo,
  markerHoverPreviewRef,
  logMapSelectionDebug,
}: RenderProviderMarkersOptions): ProviderMapPointMarker[] {
  const nextFacilityMarkers: ProviderMapPointMarker[] = [];

  visibleFacilities.forEach((facility) => {
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
    const baseMarkerHtml = getSharedPinSvgMarkup('providerLocations', scaledSize, {
      color: facility.type === 'hospital' ? 'hsl(var(--hospital))' : 'hsl(var(--clinic))',
      opacity: markerOpacity,
    });

    // Tier 1 highlight is an additive visual ring on existing clinic pins.
    // Strict source of truth: facility.tier === 'tier1' (set in facilities.ts).
    // Only applies when both the Provider Locations layer and the Tier 1
    // Highlight toggle are on. Never adds a new marker, never replaces the
    // pin color, never affects hospitals.
    const isTier1Clinic = facility.type === 'clinic' && facility.tier === 'tier1';
    const showTier1Ring = isTier1Clinic && showTier1Highlight;
    const markerHtml = showTier1Ring
      ? `<div class="tier1-ring" aria-label="Tier 1 Provider">${baseMarkerHtml}</div>`
      : baseMarkerHtml;

    const icon = L.divIcon({
      className: '',
      html: markerHtml,
      iconSize: [hitSize, hitSize],
      iconAnchor: [hitSize / 2, hitSize],
      tooltipAnchor: [0, -hitSize],
    });

    const marker = L.marker([displayLat, displayLng], {
      icon,
      pane: facilityMarkersPane,
      zIndexOffset: baseZIndexOffset,
    }) as ProviderMapPointMarker;

    marker.__pointKind = 'providerLocations';
    marker.__providerType = facility.type === 'hospital' ? 'hospital' : 'clinic';
    marker.__baseZIndexOffset = baseZIndexOffset;
    marker.__entity = { type: 'facility', facility };
    marker.__entityType = 'facility';
    marker.__entityId = facility.id;
    marker.__entityName = facility.name;
    applyMarkerPriority(marker, 'default');
    logMapSelectionDebug('marker-rendered', marker.__entity, { source: 'facility-marker', pointKind: marker.__pointKind });

    // No hover interaction for pins — click only

    marker.on('click', (event: L.LeafletEvent) => {
      selectMarkerEntity(marker.__entity as ProviderPointSelectionEntity | undefined, 'facility-marker', event, marker);

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
          selectMarkerEntity(marker.__entity as ProviderPointSelectionEntity | undefined, 'facility-marker-native', null, marker);
        });
      }
    });

    const classification = getFacilityClassification(facility);
    const typeLabel = classification === 'clinic_provider' && facility.tier === 'tier1'
      ? 'Clinic / Community Provider'
      : getFacilityTypeLabel(facility);

    const claimsMetrics = getProviderClaimsMetrics(facility);
     // PUBLIC_SAFE_MODE: hide claims-derived metrics (members attributed,
     // penetration) from hover tooltips.
     const publicMode = isPublicSafeModeActive();
     const claimsDetail = (!publicMode && claimsMetrics)
       ? `Members: ${claimsMetrics.totalMembersAttributed.toLocaleString()} · Seen: ${claimsMetrics.membersSeen.toLocaleString()} · Penetration: ${(claimsMetrics.visitPenetrationRate * 100).toFixed(1)}%`
       : undefined;

    marker.on('mouseover', () => {
      const distInfo = getMemberDistanceInfo(facility.lat, facility.lng);
      markerHoverPreviewRef.current({
        name: facility.name,
        subtitle: `${facility.city}, ${facility.county} County`,
        address: facility.address,
        detail: typeLabel,
        extraHtml: [
          `Data Confidence: ${dataConfidence}`,
          !publicMode && showUtilization && util ? `Members: ${util.totalMembers.toLocaleString()} · Visits: ${util.totalVisits.toLocaleString()} · Visits/Member: ${util.visitsPerMember}` : undefined,
          claimsDetail,
        ].filter(Boolean).join('\n'),
        ...distInfo,
      });
    });
    marker.on('mouseout', () => markerHoverPreviewRef.current(null));

    nextFacilityMarkers.push(marker);
  });

  return nextFacilityMarkers;
}
