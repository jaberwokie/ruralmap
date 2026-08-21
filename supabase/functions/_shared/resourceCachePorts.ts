/**
 * Phase 2C — Deno/Supabase adapter for the shared resource-address cache.
 *
 * Both `geocode-address` and `geocode-bulk` build their ports here so there is
 * exactly ONE internal resource cache and one normalization methodology.
 *
 * All reads/writes run under the already-authorized administrative edge
 * function path (service role, admin/sysop verified by the caller). No browser
 * client ever writes `geocode_resolutions` directly.
 */
import {
  RESOURCE_LOCATION_CLASS,
  type ResourceCachePorts,
  type ResourceCacheRow,
  type ResourceExternalPort,
} from './resourceGeocodeCache.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

export const CACHE_COLUMNS =
  'id, lookup_key, location_class, latitude, longitude, geocode_source, confidence, precision, county_name, county_fips, state, postal_code, is_manual, is_coordinate_locked, verified_at, source_metadata';

/**
 * Phase 2D.1 — bounded supersession history.
 *
 * When a retired-provider (google | nominatim) cache row is superseded by a
 * validated Census result, the previous provenance is preserved instead of
 * being silently overwritten. Bound: the newest
 * `MAX_SUPERSESSION_HISTORY` entries are kept (oldest dropped) so the row can
 * never grow without limit. This is provenance preservation, not an audit
 * platform: no credentials, no provider URLs, no raw payloads.
 */
export const MAX_SUPERSESSION_HISTORY = 5;

export interface SupersededResolution {
  previous_provider: string | null;
  previous_latitude: number | null;
  previous_longitude: number | null;
  previous_confidence: string | null;
  previous_precision: string | null;
  superseded_at: string;
  replacement_provider: string;
}

const LEGACY_SOURCES = ['google', 'nominatim'];

/**
 * Merge the incoming metadata with the existing metadata, appending a
 * supersession entry when a legacy-provider row is being replaced.
 * Earlier history is retained, never rewritten.
 */
export const buildSupersededMetadata = (
  existing: {
    geocode_source?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    confidence?: string | null;
    precision?: string | null;
    source_metadata?: Record<string, unknown> | null;
  } | null,
  incoming: Record<string, unknown>,
  replacementProvider: string,
  now: string,
): Record<string, unknown> => {
  const priorMeta = (existing?.source_metadata ?? {}) as Record<string, unknown>;
  // Existing metadata is retained; incoming keys win for CURRENT authority.
  const merged: Record<string, unknown> = { ...priorMeta, ...incoming };

  const prevProvider = existing?.geocode_source ?? null;
  const isLegacySupersession =
    !!prevProvider &&
    LEGACY_SOURCES.includes(prevProvider) &&
    prevProvider !== replacementProvider;

  const prevHistory = Array.isArray(priorMeta.superseded_resolution)
    ? (priorMeta.superseded_resolution as unknown[])
    : priorMeta.superseded_resolution
      ? [priorMeta.superseded_resolution]
      : [];

  if (!isLegacySupersession) {
    // Never destroy earlier supersession history on unrelated updates.
    if (prevHistory.length > 0) merged.superseded_resolution = prevHistory;
    return merged;
  }

  const entry: SupersededResolution = {
    previous_provider: prevProvider,
    previous_latitude: existing?.latitude ?? null,
    previous_longitude: existing?.longitude ?? null,
    previous_confidence: existing?.confidence ?? null,
    previous_precision: existing?.precision ?? null,
    superseded_at: now,
    replacement_provider: replacementProvider,
  };

  merged.superseded_resolution = [...prevHistory, entry].slice(-MAX_SUPERSESSION_HISTORY);
  return merged;
};


export const createResourceCachePorts = (
  db: Db,
  secret: string,
  geocoders: ResourceExternalPort[],
): ResourceCachePorts => ({
  secret,
  geocoders,
  now: () => new Date().toISOString(),

  lookup: async (lookupKey) => {
    const { data } = await db
      .from('geocode_resolutions')
      .select(CACHE_COLUMNS)
      .eq('lookup_key', lookupKey)
      .eq('location_class', RESOURCE_LOCATION_CLASS)
      .maybeSingle();
    return (data as ResourceCacheRow | null) ?? null;
  },

  upsert: async (row) => {
    const { data: existing } = await db
      .from('geocode_resolutions')
      .select(
        'id, is_manual, is_coordinate_locked, geocode_source, use_count, latitude, longitude, confidence, precision, source_metadata',
      )
      .eq('lookup_key', row.lookup_key)
      .eq('location_class', RESOURCE_LOCATION_CLASS)
      .maybeSingle();

    if (!existing) {
      await db.from('geocode_resolutions').insert({ ...row, use_count: 1, cache_hit_count: 0 });
      return;
    }

    // Manual / verified authority is never overwritten by automation.
    const protectedRow =
      existing.is_manual || existing.is_coordinate_locked || existing.geocode_source === 'manual_verified';
    if (protectedRow && row.geocode_source !== 'manual_verified') return;

    // Phase 2D.1: preserve superseded legacy (google | nominatim) provenance
    // BEFORE current authority changes.
    const source_metadata = buildSupersededMetadata(
      existing,
      row.source_metadata ?? {},
      row.geocode_source,
      new Date().toISOString(),
    );

    await db
      .from('geocode_resolutions')
      .update({
        latitude: row.latitude,
        longitude: row.longitude,
        geocode_source: row.geocode_source,
        confidence: row.confidence,
        precision: row.precision,
        county_name: row.county_name,
        county_fips: row.county_fips,
        state: row.state,
        postal_code: row.postal_code,
        is_manual: row.is_manual,
        is_coordinate_locked: row.is_coordinate_locked,
        verified_at: row.verified_at,
        source_metadata,
        use_count: (existing.use_count ?? 1) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  },


  touch: async (lookupKey) => {
    const { data: existing } = await db
      .from('geocode_resolutions')
      .select('id, use_count, cache_hit_count')
      .eq('lookup_key', lookupKey)
      .eq('location_class', RESOURCE_LOCATION_CLASS)
      .maybeSingle();
    if (!existing) return;
    await db
      .from('geocode_resolutions')
      .update({
        use_count: (existing.use_count ?? 0) + 1,
        cache_hit_count: (existing.cache_hit_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  },
});
