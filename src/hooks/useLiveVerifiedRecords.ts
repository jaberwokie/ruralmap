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
 *   - Same-tab: subscribed to `verified-records-changed` window event so
 *     promote/reject/deactivate/edit actions trigger an immediate refetch.
 *   - Cross-tab (same browser/profile): subscribed to a BroadcastChannel
 *     of the same name so admin actions in another tab also refresh this
 *     tab's map without a reload. Cross-browser / cross-user / cross-device
 *     sync is NOT supported — that requires a Realtime subscription.
 *
 * Failure surface:
 *   - Fetch errors no longer fail silently. The hook exposes `error` and
 *     fires a single sonner toast per failure. The map keeps rendering
 *     the static dataset.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { listVerifiedServices, listVerifiedBh } from '@/utils/mappingPipelineStore';
import type { RuralService, RuralServiceCategory } from '@/data/rural-services';

export const VERIFIED_RECORDS_CHANGED_EVENT = 'verified-records-changed';
const BROADCAST_CHANNEL_NAME = 'verified-records-changed';

/** Lazy-singleton BroadcastChannel so multiple hook instances share one channel. */
let sharedChannel: BroadcastChannel | null = null;
const getChannel = (): BroadcastChannel | null => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!sharedChannel) sharedChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  return sharedChannel;
};

/**
 * Notify all live-map consumers to refetch from Cloud.
 * - Dispatches a same-tab window event (legacy listeners).
 * - Posts to a BroadcastChannel for cross-tab consumers in the same browser.
 */
export const notifyVerifiedRecordsChanged = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VERIFIED_RECORDS_CHANGED_EVENT));
  try { getChannel()?.postMessage({ type: 'changed', at: Date.now() }); } catch { /* noop */ }
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

export const useLiveVerifiedRecords = (): {
  records: RuralService[];
  ready: boolean;
  error: string | null;
  refetch: () => void;
} => {
  const [records, setRecords] = useState<RuralService[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastToastAtRef = useRef<number>(0);

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
        setError(null);
      } catch (e) {
        // Surface — keep static dataset intact (records left as-is) but flag failure.
        const msg = (e as Error)?.message ?? 'Unknown error';
        setError(`Live verified records unavailable: ${msg}`);
        // Throttle toast to once per 30s to avoid spam from repeated refetch storms.
        const now = Date.now();
        if (now - lastToastAtRef.current > 30_000) {
          lastToastAtRef.current = now;
          toast.error('Live verified records unavailable', {
            description: msg,
            duration: 6000,
          });
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  // Same-tab refresh signal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => refetch();
    window.addEventListener(VERIFIED_RECORDS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(VERIFIED_RECORDS_CHANGED_EVENT, handler);
  }, [refetch]);

  // Cross-tab refresh signal (same browser/profile) via BroadcastChannel.
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;
    const handler = (_ev: MessageEvent) => refetch();
    ch.addEventListener('message', handler);
    return () => ch.removeEventListener('message', handler);
  }, [refetch]);

  return { records, ready, error, refetch };
};
