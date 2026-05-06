import L from 'leaflet';
import { DEBUG_CLICKS } from '@/components/map/debugClickOverlay';
import type { MapEntity } from '@/types/entities';

export const DEBUG_ENABLED = DEBUG_CLICKS;

export const SELECTION_GUARD_MS = 220;

export const getEntityDebugMeta = (entity: MapEntity | null | undefined) => {
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

/**
 * Stops a Leaflet or DOM event from propagating. Prefers the underlying
 * originalEvent when present (Leaflet wraps native DOM events).
 */
export const stopInteractionEvent = (event?: L.LeafletEvent | Event | null) => {
  if (!event) return;
  const originalEvent = (event as L.LeafletEvent & { originalEvent?: Event }).originalEvent;
  if (originalEvent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L.DomEvent.stop(originalEvent as any);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L.DomEvent.stop(event as any);
};
