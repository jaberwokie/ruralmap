import { SELECTION_GUARD_MS } from '@/components/map/layers/MapInteractionUtils';

/**
 * Mutable refs that back the selection guard system. The owning component
 * (MapView) creates and owns the refs; these helpers are pure operations
 * over them so all guard timing logic lives in one place.
 *
 * `interactionGuardUntil` blocks background-click clearing after any
 * marker/county/overlay click. `markerGuardUntil` is a stricter window
 * specifically used to suppress underlying county clicks fired immediately
 * after a marker click.
 */
export interface SelectionGuardRefs {
  interactionGuardUntil: { current: number };
  markerGuardUntil: { current: number };
}

export type SelectionGuardSource = 'marker' | 'county' | 'overlay';

/** Extends both guard windows. Marker source also extends the marker-only guard. */
export function armSelectionGuard(refs: SelectionGuardRefs, source: SelectionGuardSource) {
  const expiresAt = Date.now() + SELECTION_GUARD_MS;
  refs.interactionGuardUntil.current = Math.max(refs.interactionGuardUntil.current, expiresAt);
  if (source === 'marker') refs.markerGuardUntil.current = expiresAt;
}

/** True if any marker/county/overlay click happened within the guard window. */
export function isInteractionGuardActive(refs: SelectionGuardRefs): boolean {
  return Date.now() < refs.interactionGuardUntil.current;
}

/** True if a marker click happened within the guard window. */
export function isMarkerGuardActive(refs: SelectionGuardRefs): boolean {
  return Date.now() < refs.markerGuardUntil.current;
}
