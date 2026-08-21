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
      .select('id, is_manual, is_coordinate_locked, geocode_source, use_count')
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
        source_metadata: row.source_metadata,
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
