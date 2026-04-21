/**
 * Live-merge hook: pulls promoted verified rows from Cloud and converts them
 * into RuralService shape so they merge with the static enriched dataset
 * already consumed by MapView.
 *
 * - Verified Services → RuralService (semantic green / community-support)
 * - Verified BH      → RuralService with BH category (purple, via
 *                       isBehavioralHealthService classifier)
 *
 * Refresh model:
 *   - Initial fetch on mount.
 *   - Subscribed to `verified-records-changed` window event so promote/reject/
 *     deactivate/edit actions trigger an immediate refetch with no full reload.
 */

import { useCallback, useEffect, useState } from 'react';
import { listVerifiedServices, listVerifiedBh } from '@/utils/mappingPipelineStore';
import type { RuralService, RuralServiceCategory } from '@/data/rural-services';

export const VERIFIED_RECORDS_CHANGED_EVENT = 'verified-records-changed';

/** Notify all live-map consumers to refetch from Cloud. */
export const notifyVerifiedRecordsChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VERIFIED_RECORDS_CHANGED_EVENT));
  }
};

/**
 * Service category mapping. `'Mental Health'` and `'Substance Use'` are the
 * two categories recognized by `isBehavioralHealthService` — verified BH rows
 * are forced into one of these so they render with BH (purple) styling.
 */
const mapServiceCategory = (raw: string | null): RuralServiceCategory => {
  if (!raw) return 'Family Services';
  const lc = raw.toLowerCase();
  if (lc.includes('food')) return 'Food';
  if (lc.includes('shelter')) return 'Shelter';
  if (lc.includes('housing')) return 'Housing (Low-Income)';
  if (lc.includes('legal')) return 'Legal';
  if (lc.includes('employ')) return 'Employment';
  if (lc.includes('senior')) return 'Senior Services';
  if (lc.includes('disab')) return 'Disability Services';
  if (lc.includes('recover') || lc.includes('peer') || lc.includes('boarding')) return 'Recovery/Boarding';
  if (lc.includes('coordin') || lc.includes('intake')) return 'Coordinated Entry';
  if (lc.includes('supportive housing')) return 'Supportive Housing';
  if (lc.includes('substance') || lc.includes('sud') || lc.includes('mat') || lc.includes('detox')) return 'Substance Use';
  if (lc.includes('mental') || lc.includes('behavioral')) return 'Mental Health';
  if (lc.includes('physical')) return 'Physical Health';
  return 'Family Services';
};

/**
 * BH-specific category derivation. Always returns 'Mental Health' or
 * 'Substance Use', both of which classify as Behavioral Health entities.
 */
const mapBhCategory = (entityType: string | null, serviceType: string | null): RuralServiceCategory => {
  const t = `${entityType ?? ''} ${serviceType ?? ''}`.toLowerCase();
  if (t.includes('sud') || t.includes('substance') || t.includes('detox') || t.includes('mat')) return 'Substance Use';
  return 'Mental Health';
};

const isPlaceable = (lat: number | null, lng: number | null): boolean =>
  lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

export const useLiveVerifiedRecords = (): { records: RuralService[]; ready: boolean; refetch: () => void } => {
  const [records, setRecords] = useState<RuralService[]>([]);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [services, bh] = await Promise.all([listVerifiedServices(), listVerifiedBh()]);
        if (cancelled) return;
        const out: RuralService[] = [];
        services.forEach((s) => {
          if (!s.active_status || !isPlaceable(s.latitude, s.longitude)) return;
          out.push({
            id: `verified-svc-${s.id}`,
            name: s.name,
            category: mapServiceCategory(s.service_category),
            county: s.county ?? '',
            city: s.city ?? '',
            address: s.street_address ?? undefined,
            phone: s.phone ?? undefined,
            website: s.website ?? undefined,
            notes: s.access_notes ?? s.description ?? undefined,
            lat: s.latitude as number,
            lng: s.longitude as number,
          });
        });
        bh.forEach((b) => {
          if (!b.active_status || !isPlaceable(b.latitude, b.longitude)) return;
          out.push({
            id: `verified-bh-${b.id}`,
            name: b.name,
            category: mapBhCategory(b.bh_entity_type, b.bh_service_type),
            county: b.county ?? '',
            city: b.city ?? '',
            address: b.street_address ?? undefined,
            phone: b.phone ?? undefined,
            website: b.website ?? undefined,
            notes: b.access_notes ?? b.description ?? undefined,
            lat: b.latitude as number,
            lng: b.longitude as number,
          });
        });
        setRecords(out);
      } catch {
        // silent — static dataset still renders
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  // Subscribe to global change events so promote/edit/deactivate refresh the map.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => refetch();
    window.addEventListener(VERIFIED_RECORDS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(VERIFIED_RECORDS_CHANGED_EVENT, handler);
  }, [refetch]);

  return { records, ready, refetch };
};
