/**
 * Shared, cross-route store for facilities imported via CSV.
 *
 * Persisted in localStorage so imports survive reloads, and broadcast via
 * `storage` events + a custom in-page event so any open route (the map, the
 * admin import page) sees the same list immediately.
 *
 * NOTE: This intentionally does NOT touch defaultFacilities, scoring,
 * verification queue, or any other map logic. It only lifts the previous
 * in-memory `useState<Facility[]>` from useFacilityData into a place the
 * admin page can write to.
 */

import type { Facility } from '@/data/facilities';

const STORAGE_KEY = 'nbh_imported_facilities_v1';
const EVENT_NAME = 'nbh:imported-facilities-changed';

const safeParse = (raw: string | null): Facility[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getImportedFacilities = (): Facility[] => {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeImportedFacilities = (next: Facility[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    // Quota or serialization failure — surface but don't crash callers.
    console.warn('[importedFacilitiesStore] failed to persist', err);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

export const appendImportedFacilities = (additions: Facility[]): Facility[] => {
  const current = getImportedFacilities();
  const next = [...current, ...additions];
  writeImportedFacilities(next);
  return next;
};

export const clearImportedFacilities = (): void => {
  writeImportedFacilities([]);
};

/** Subscribe to changes from any tab/route. Returns an unsubscribe fn. */
export const subscribeToImportedFacilities = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
  const onCustom = () => cb();
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onCustom as EventListener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onCustom as EventListener);
  };
};
