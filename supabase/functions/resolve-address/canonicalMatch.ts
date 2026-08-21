/**
 * Canonical Rural Tool resource matcher for member-address resolution.
 *
 * Extracted from `index.ts` so the exact-match semantics (deleted, mappable,
 * active, coordinate ownership, Nevada bounds) are behaviorally testable.
 *
 * Exact canonicalized-address equality only. No fuzzy matching: a wrong
 * canonical match would place a member at the wrong location.
 */
import { canonicalizeAddress, isInNevada } from '../_shared/geocodeNormalize.ts';

export interface CanonicalTableSpec {
  table: 'facilities' | 'rural_services' | 'verified_services' | 'verified_bh';
  latCol: string;
  lngCol: string;
  /** Live map tables gate on `mappable = true`. */
  requireMappable: boolean;
  /** Verified tables carry `active_status`; live map tables do not. */
  requireActive: boolean;
}

/**
 * Canonical tables that own real map-resource coordinates, with the column
 * semantics each family actually uses.
 *
 * - `facilities` / `rural_services`: canonical LIVE map resources. Coordinates
 *   are `manual_lat/lng` (curated) → `lat/lng`. Non-mappable rows are excluded.
 *   Neither table has an `active_status` column, so none is applied.
 * - `verified_services` / `verified_bh`: promoted verified records. Coordinates
 *   are `manual_lat/lng` → `latitude/longitude`. Inactive records (
 *   `active_status != true`) must never resolve a member address.
 */
export const CANONICAL_TABLES: CanonicalTableSpec[] = [
  { table: 'facilities', latCol: 'lat', lngCol: 'lng', requireMappable: true, requireActive: false },
  { table: 'rural_services', latCol: 'lat', lngCol: 'lng', requireMappable: true, requireActive: false },
  { table: 'verified_services', latCol: 'latitude', lngCol: 'longitude', requireMappable: false, requireActive: true },
  { table: 'verified_bh', latCol: 'latitude', lngCol: 'longitude', requireMappable: false, requireActive: true },
];

export interface CanonicalQueryBuilder {
  is(column: string, value: null): CanonicalQueryBuilder;
  eq(column: string, value: unknown): CanonicalQueryBuilder;
  ilike(column: string, value: string): CanonicalQueryBuilder;
  limit(n: number): CanonicalQueryBuilder;
  then<T>(
    onfulfilled: (r: { data: Array<Record<string, unknown>> | null }) => T,
  ): Promise<T>;
}

export interface CanonicalDbClient {
  from(table: string): { select(columns: string): CanonicalQueryBuilder };
}

export interface CanonicalHit {
  lat: number;
  lng: number;
  confidence: string;
  precision: string;
  county: string | null;
  postal_code: string | null;
  label: string;
  source: 'canonical_resource';
}

export const createCanonicalMatch = (
  db: CanonicalDbClient,
  specs: CanonicalTableSpec[] = CANONICAL_TABLES,
) => async (canonicalInput: string): Promise<CanonicalHit | null> => {
  const canon = canonicalizeAddress(canonicalInput);
  if (!canon.street) return null;

  for (const spec of specs) {
    let query = db
      .from(spec.table)
      .select(
        `street_address, city, state, zip, county, ${spec.latCol}, ${spec.lngCol}, manual_lat, manual_lng, coordinate_locked, coordinate_confidence`,
      )
      .is('deleted_at', null)
      .limit(50);
    if (spec.requireMappable) query = query.eq('mappable', true);
    // Inactive verified records are not canonical authority for placement.
    if (spec.requireActive) query = query.eq('active_status', true);
    if (canon.zip) query = query.eq('zip', canon.zip);
    else if (canon.city) query = query.ilike('city', canon.city);
    else continue;

    const { data } = await query;
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const street = String(row.street_address ?? '');
      const city = String(row.city ?? '');
      const zip = String(row.zip ?? '');
      if (!street) continue;
      const rowCanon = canonicalizeAddress(`${street}, ${city}, NV ${zip}`);
      if (rowCanon.canonical !== canon.canonical) continue;

      // Curated/manual coordinates outrank automated ones; a coordinate
      // lock means the curated value is the only acceptable answer.
      // NB: Number(null) is 0, so null curated columns must be rejected
      // explicitly or a member would be placed at lat/lng 0,0.
      const manualLat = row.manual_lat == null ? NaN : Number(row.manual_lat);
      const manualLng = row.manual_lng == null ? NaN : Number(row.manual_lng);
      const hasManual = Number.isFinite(manualLat) && Number.isFinite(manualLng);
      const rawLat = row[spec.latCol];
      const rawLng = row[spec.lngCol];
      const lat = hasManual ? manualLat : (rawLat == null ? NaN : Number(rawLat));
      const lng = hasManual ? manualLng : (rawLng == null ? NaN : Number(rawLng));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!isInNevada(lat, lng)) continue;

      return {
        lat,
        lng,
        confidence: String(row.coordinate_confidence ?? 'high'),
        precision: 'rooftop',
        county: (row.county as string | null) ?? null,
        postal_code: zip || null,
        label: `${street}, ${city}, NV`,
        source: 'canonical_resource' as const,
      };
    }
  }
  return null;
};
