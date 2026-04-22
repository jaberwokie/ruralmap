/**
 * Service geocoding workflow.
 *
 * Targets staging/verified service rows where `mappable = true` and
 * latitude/longitude are blank. Uses OpenStreetMap Nominatim (no API key).
 *
 * Strategy:
 *   1. Primary query: street_address + city + state + zip
 *   2. Fallback query: city + county + state
 *   3. If both fail → record stays active (list-only context), no pin.
 *
 * Confidence is derived from:
 *   - Nominatim result `class`/`type` (building/place/amenity → high)
 *   - Whether the primary or fallback strategy succeeded
 *   - Result importance score
 *
 * Source + confidence are persisted in `access_notes` as a structured
 * suffix tag so we don't need a schema migration. The bus broadcasts
 * after each batch so the live map refreshes.
 */
import type { StagingServiceRow, VerifiedServiceRow } from '@/types/mappingPipeline';

export type GeocodeStrategy = 'address_full' | 'city_county_fallback';
export type GeocodeConfidence = 'high' | 'medium' | 'low';

export interface GeocodeOutcome {
  id: string;
  status: 'geocoded' | 'failed' | 'skipped';
  strategy?: GeocodeStrategy;
  confidence?: GeocodeConfidence;
  latitude?: number;
  longitude?: number;
  reason?: string;
}

export interface GeocodeRunSummary {
  total: number;
  geocoded: number;
  failed: number;
  skipped: number;
  highConf: number;
  mediumConf: number;
  lowConf: number;
  outcomes: GeocodeOutcome[];
}

export type GeocodeCandidate = Pick<
  StagingServiceRow & VerifiedServiceRow,
  'id' | 'mappable' | 'latitude' | 'longitude' | 'street_address' | 'city' | 'state' | 'zip' | 'county' | 'access_notes'
>;

export const GEOCODE_TAG_PREFIX = '[geocode:';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const buildAddressQuery = (r: GeocodeCandidate): string | null => {
  const parts = [r.street_address, r.city, r.state, r.zip].filter((p) => !!p && String(p).trim() !== '');
  if (parts.length < 2) return null;
  if (!r.street_address) return null;
  return parts.join(', ');
};

const buildFallbackQuery = (r: GeocodeCandidate): string | null => {
  const parts: string[] = [];
  if (r.city) parts.push(String(r.city));
  if (r.county) parts.push(`${r.county} County`);
  if (r.state) parts.push(String(r.state));
  if (parts.length < 2) return null;
  return parts.join(', ');
};

interface NominatimResult {
  lat: string;
  lon: string;
  importance?: number;
  class?: string;
  type?: string;
  display_name?: string;
}

const fetchNominatim = async (query: string): Promise<NominatimResult | null> => {
  const url = `${NOMINATIM_URL}?format=json&limit=1&addressdetails=0&countrycodes=us&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    return data?.[0] ?? null;
  } catch {
    return null;
  }
};

const scoreConfidence = (
  strategy: GeocodeStrategy,
  result: NominatimResult,
): GeocodeConfidence => {
  const cls = (result.class ?? '').toLowerCase();
  const typ = (result.type ?? '').toLowerCase();
  const importance = result.importance ?? 0;

  if (strategy === 'address_full') {
    if (cls === 'building' || typ === 'house' || typ === 'building') return 'high';
    if (cls === 'amenity' || cls === 'shop' || cls === 'office') return 'high';
    if (importance >= 0.5) return 'high';
    return 'medium';
  }
  // fallback (city/county) is inherently approximate
  if (importance >= 0.6) return 'medium';
  return 'low';
};

/** Build the access_notes value with a geocode tag appended (replaces any prior tag). */
export const stampGeocodeTag = (
  notes: string | null | undefined,
  strategy: GeocodeStrategy,
  confidence: GeocodeConfidence,
): string => {
  const base = (notes ?? '').replace(/\s*\[geocode:[^\]]+\]\s*$/i, '').trim();
  const tag = `${GEOCODE_TAG_PREFIX}${strategy}|${confidence}|${new Date().toISOString().slice(0, 10)}]`;
  return base.length > 0 ? `${base} ${tag}` : tag;
};

/** Parse a stored geocode tag back, if present. */
export const parseGeocodeTag = (
  notes: string | null | undefined,
): { strategy: GeocodeStrategy; confidence: GeocodeConfidence; date: string } | null => {
  if (!notes) return null;
  const m = notes.match(/\[geocode:([^|]+)\|([^|]+)\|([^\]]+)\]/i);
  if (!m) return null;
  return {
    strategy: m[1] as GeocodeStrategy,
    confidence: m[2] as GeocodeConfidence,
    date: m[3],
  };
};

const FAILED_TAG = '[geocode:failed]';

export const stampGeocodeFailure = (notes: string | null | undefined): string => {
  const base = (notes ?? '').replace(/\s*\[geocode:[^\]]+\]\s*$/i, '').trim();
  return base.length > 0 ? `${base} ${FAILED_TAG}` : FAILED_TAG;
};

export const isGeocodeFailed = (notes: string | null | undefined): boolean =>
  !!notes && /\[geocode:failed\]/i.test(notes);

/**
 * Geocode a single record. Caller is responsible for persistence.
 * Returns the outcome (does NOT call the DB).
 */
export const geocodeOne = async (r: GeocodeCandidate): Promise<GeocodeOutcome> => {
  // Guard: must be mappable
  if (r.mappable === false) {
    return { id: r.id, status: 'skipped', reason: 'list-only (mappable=false)' };
  }
  // Guard: never overwrite existing coords
  if (r.latitude != null && r.longitude != null) {
    return { id: r.id, status: 'skipped', reason: 'already has coordinates' };
  }

  // Strategy 1 — full address
  const addrQ = buildAddressQuery(r);
  if (addrQ) {
    const hit = await fetchNominatim(addrQ);
    if (hit) {
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          id: r.id,
          status: 'geocoded',
          strategy: 'address_full',
          confidence: scoreConfidence('address_full', hit),
          latitude: lat,
          longitude: lng,
        };
      }
    }
  }

  // Strategy 2 — city + county + state fallback
  const fbQ = buildFallbackQuery(r);
  if (fbQ) {
    const hit = await fetchNominatim(fbQ);
    if (hit) {
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          id: r.id,
          status: 'geocoded',
          strategy: 'city_county_fallback',
          confidence: scoreConfidence('city_county_fallback', hit),
          latitude: lat,
          longitude: lng,
        };
      }
    }
  }

  return { id: r.id, status: 'failed', reason: 'no geocoder match' };
};

/**
 * Sequential, throttled geocode. Nominatim public policy = max 1 req/sec.
 * We respect that with a 1100ms delay between calls.
 */
export const geocodeMany = async (
  records: GeocodeCandidate[],
  onProgress?: (done: number, total: number, last: GeocodeOutcome) => void,
): Promise<GeocodeOutcome[]> => {
  const outcomes: GeocodeOutcome[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const outcome = await geocodeOne(r);
    outcomes.push(outcome);
    onProgress?.(i + 1, records.length, outcome);
    // Throttle only when we actually hit the network
    if (outcome.status !== 'skipped' && i < records.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return outcomes;
};

export const summarizeGeocodeRun = (outcomes: GeocodeOutcome[]): GeocodeRunSummary => {
  let geocoded = 0, failed = 0, skipped = 0, high = 0, med = 0, low = 0;
  for (const o of outcomes) {
    if (o.status === 'geocoded') {
      geocoded += 1;
      if (o.confidence === 'high') high += 1;
      else if (o.confidence === 'medium') med += 1;
      else if (o.confidence === 'low') low += 1;
    } else if (o.status === 'failed') failed += 1;
    else skipped += 1;
  }
  return {
    total: outcomes.length,
    geocoded,
    failed,
    skipped,
    highConf: high,
    mediumConf: med,
    lowConf: low,
    outcomes,
  };
};
