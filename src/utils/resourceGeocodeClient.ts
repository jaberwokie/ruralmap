/**
 * Phase 2D — the ONLY browser entry point for public-resource geocoding.
 *
 * The browser never contacts an external geocoder. It submits stable explicit
 * record IDs to the authenticated `geocode-bulk` Edge Function, which resolves
 * them through the internal `resource_address` authority and the U.S. Census
 * Geocoder, then normalizes the server response into the existing
 * `GeocodeRunSummary` shape the Admin mapping UI already consumes.
 *
 * Batching is by ID, never by numeric offset over a mutable `lat IS NULL` set:
 * that pattern skipped records as earlier batches became resolved.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  summarizeGeocodeRun,
  type GeocodeOutcome,
  type GeocodeRunSummary,
} from '@/utils/serviceGeocode';
import type { GeocodeConfidence, GeocodeStrategy } from '@/utils/geocodeTags';

/** Tables the server pipeline accepts. Mirrors the server contract map. */
export type ResourceGeocodeTable =
  | 'facilities'
  | 'rural_services'
  | 'verified_services'
  | 'verified_bh'
  | 'staging_services'
  | 'staging_bh'
  | 'staging_facilities'
  | 'staging_rural_services'
  | 'staging_providers';

/** Server accepts at most 200 ids per request; stay comfortably under it. */
export const GEOCODE_CHUNK_SIZE = 50;

interface ServerOutcome {
  id: string;
  status: 'geocoded' | 'failed' | 'skipped';
  strategy?: string;
  confidence?: string;
  latitude?: number;
  longitude?: number;
  reason?: string;
}

const normalizeOutcome = (o: ServerOutcome): GeocodeOutcome => ({
  id: o.id,
  status: o.status,
  strategy: o.strategy as GeocodeStrategy | undefined,
  confidence: (o.confidence === 'high' ? 'high' : o.confidence ? 'low' : undefined) as
    | GeocodeConfidence
    | undefined,
  latitude: o.latitude,
  longitude: o.longitude,
  reason: o.reason,
});

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export interface ResourceGeocodeOptions {
  force?: boolean;
  onProgress?: (done: number, total: number, last: GeocodeOutcome) => void;
}

/**
 * Geocode an exact, stable set of record IDs server-side.
 * Every supplied ID is submitted exactly once.
 */
export const geocodeResourceIds = async (
  table: ResourceGeocodeTable,
  ids: string[],
  options?: ResourceGeocodeOptions,
): Promise<GeocodeRunSummary> => {
  const stableIds = [...new Set(ids.filter(Boolean))];
  if (stableIds.length === 0) return summarizeGeocodeRun([]);

  const outcomes: GeocodeOutcome[] = [];
  let done = 0;

  for (const batch of chunk(stableIds, GEOCODE_CHUNK_SIZE)) {
    const { data, error } = await supabase.functions.invoke('geocode-bulk', {
      body: { table, ids: batch, force: options?.force ?? false },
    });

    if (error || !data || !Array.isArray(data.outcomes)) {
      // A failed batch must not abort the rest of the run.
      for (const id of batch) {
        const oc: GeocodeOutcome = {
          id,
          status: 'failed',
          reason: error?.message ?? (data as { error?: string })?.error ?? 'geocode_request_failed',
        };
        outcomes.push(oc);
        done += 1;
        options?.onProgress?.(done, stableIds.length, oc);
      }
      continue;
    }

    for (const raw of data.outcomes as ServerOutcome[]) {
      const oc = normalizeOutcome(raw);
      outcomes.push(oc);
      done += 1;
      options?.onProgress?.(done, stableIds.length, oc);
    }
  }

  return summarizeGeocodeRun(outcomes);
};

/**
 * Establish the eligible ID set ONCE (records missing a display coordinate),
 * so batching cannot skip rows as earlier batches become resolved.
 */
export const listUnresolvedResourceIds = async (
  table: ResourceGeocodeTable,
  latColumn: 'lat' | 'latitude',
): Promise<string[]> => {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .is(latColumn, null)
    .limit(5000);
  if (error) return [];
  return (data ?? []).map((r: { id: string }) => String(r.id));
};

/** Admin/SysOp dry-run legacy (Google/Nominatim) revalidation comparison. */
export const runLegacyRevalidationDryRun = async (
  table: ResourceGeocodeTable,
  limit = 25,
): Promise<unknown> => {
  const { data, error } = await supabase.functions.invoke('geocode-bulk', {
    body: { table, mode: 'dry_run_revalidation', limit },
  });
  if (error) throw new Error(error.message);
  return data;
};

/**
 * Phase 2D.1 §9 — ONE combined, read-only dry-run across every supported
 * resource table. Census calls are deduplicated by canonical resource-address
 * identity across tables. `offset` slices the canonical address list only; it
 * never changes grouping or inventory counters. Nothing is mutated.
 */
export const runCombinedLegacyDryRun = async (
  opts: { limit?: number; offset?: number; tables?: ResourceGeocodeTable[] } = {},
): Promise<Record<string, unknown>> => {
  const { data, error } = await supabase.functions.invoke('geocode-bulk', {
    body: {
      mode: 'dry_run_revalidation',
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
      ...(opts.tables ? { tables: opts.tables } : {}),
    },
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
};

