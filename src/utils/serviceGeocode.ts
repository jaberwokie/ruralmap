/**
 * Service geocoding workflow.
 *
 * Targets staging/verified service rows where `mappable = true` and
 * latitude/longitude are blank. Uses OpenStreetMap Nominatim (no API key).
 *
 * Strategy:
 *   1. Primary query: street_address + city + state + zip
 *      → Nevada-bounded, addressdetails=1, limit=5, validated against the
 *        source record (state/city/ZIP/house number/road, class/type).
 *   2. Fallback query: city + county + state
 *      → Nevada-bounded, addressdetails=1, limit=5, validated against the
 *        source city/county. Accepts place/admin types intentionally.
 *   3. If neither produces a valid candidate → record stays active
 *      (list-only context), no pin.
 *
 * Confidence is derived from:
 *   - Strategy used (address_full = high, fallback = low; collapsed by the
 *     store before persistence).
 *   - Whether validation actually matched the source address.
 *
 * Source + confidence are persisted in `access_notes` as a structured
 * suffix tag so we don't need a schema migration. The bus broadcasts
 * after each batch so the live map refreshes.
 */
import type { StagingServiceRow, VerifiedServiceRow } from '@/types/mappingPipeline';

export type GeocodeStrategy = 'address_full' | 'city_county_fallback' | 'census_onelineaddress' | 'failed';
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
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

export const reverseGeocode = async (
  lat: number,
  lng: number,
): Promise<{ road?: string; postcode?: string; state?: string } | null> => {
  try {
    const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      road: data?.address?.road,
      postcode: data?.address?.postcode,
      state: data?.address?.state,
    };
  } catch {
    return null;
  }
};

export const spotCheckCoordinate = async (
  lat: number,
  lng: number,
  sourceZip: string | null | undefined,
  sourceRoad: string | null | undefined,
): Promise<{ passed: boolean; reason?: string }> => {
  const result = await reverseGeocode(lat, lng);
  if (!result) return { passed: true }; // Network failure — don't downgrade on timeout

  // State check — must be Nevada
  if (result.state && !result.state.toLowerCase().includes('nevada')) {
    return { passed: false, reason: `reverse state mismatch: ${result.state}` };
  }

  // ZIP check — if both present, first 5 digits must match
  const srcZip = (sourceZip ?? '').replace(/\D/g, '').slice(0, 5);
  const revZip = (result.postcode ?? '').replace(/\D/g, '').slice(0, 5);
  if (srcZip && revZip && srcZip !== revZip) {
    return { passed: false, reason: `reverse ZIP mismatch: ${srcZip} vs ${revZip}` };
  }

  // Road check — if both present, at least one token must overlap
  if (sourceRoad && result.road) {
    const tokenize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const srcTokens = new Set(tokenize(sourceRoad));
    const revTokens = tokenize(result.road);
    const overlap = revTokens.some(t => srcTokens.has(t));
    if (!overlap) {
      return { passed: false, reason: `reverse road mismatch: "${sourceRoad}" vs "${result.road}"` };
    }
  }

  return { passed: true };
};

// Nevada bounding box (approx.). Nominatim viewbox format: lon1,lat1,lon2,lat2
// (any two opposite corners). Pair with bounded=1 to make it a hard filter.
const NV_VIEWBOX = '-120.0064,42.0022,-114.0396,35.0019';

const normalizeQueryAddress = (street: string): string => {
  // Strip secondary unit designators (suite, unit, apt, etc.)
  let s = street
    .replace(/\b(suite|ste\.?|unit|apt\.?|apartment|bldg\.?|building|room|rm\.?|#)\s*[\w-]*/gi, '')
    .trim();
  // Normalize highway tokens
  s = s
    .replace(/\bU\.?S\.?-?\s*(\d+)\b/gi, 'US Highway $1')
    .replace(/\bN\.?V\.?-?\s*(\d+)\b/gi, 'Nevada Route $1')
    .replace(/\bS\.?R\.?-?\s*(\d+)\b/gi, 'Nevada Route $1')
    .replace(/\bHwy\.?\b/gi, 'Highway');
  // Normalize directional abbreviations to full word
  s = s
    .replace(/\bN\.\s+/gi, 'North ')
    .replace(/\bS\.\s+/gi, 'South ')
    .replace(/\bE\.\s+/gi, 'East ')
    .replace(/\bW\.\s+/gi, 'West ')
    .replace(/\bNE\.\s+/gi, 'Northeast ')
    .replace(/\bNW\.\s+/gi, 'Northwest ')
    .replace(/\bSE\.\s+/gi, 'Southeast ')
    .replace(/\bSW\.\s+/gi, 'Southwest ');
  // Collapse any double spaces left by stripping
  return s.replace(/\s{2,}/g, ' ').trim();
};

const buildAddressQuery = (r: GeocodeCandidate): string | null => {
  const parts = [normalizeQueryAddress(r.street_address ?? ''), r.city, r.state, r.zip].filter((p) => !!p && String(p).trim() !== '');
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

interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  'ISO3166-2-lvl4'?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  importance?: number;
  class?: string;
  type?: string;
  display_name?: string;
  address?: NominatimAddress;
  boundingbox?: string[];
}

const fetchNominatim = async (
  query: string,
  opts?: { limit?: number; bounded?: boolean },
): Promise<NominatimResult[]> => {
  const limit = opts?.limit ?? 5;
  const bounded = opts?.bounded !== false;
  const url =
    `${NOMINATIM_URL}?format=json&limit=${limit}&addressdetails=1&countrycodes=us` +
    `&viewbox=${encodeURIComponent(NV_VIEWBOX)}` +
    (bounded ? `&bounded=1` : '') +
    `&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// ── Normalization & comparison helpers ────────────────────────────────

const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,#'"()/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STREET_TOKEN_ALIASES: Record<string, string> = {
  street: 'st', st: 'st',
  avenue: 'ave', ave: 'ave', av: 'ave',
  road: 'rd', rd: 'rd',
  boulevard: 'blvd', blvd: 'blvd',
  drive: 'dr', dr: 'dr',
  lane: 'ln', ln: 'ln',
  highway: 'hwy', hwy: 'hwy',
  parkway: 'pkwy', pkwy: 'pkwy',
  court: 'ct', ct: 'ct',
  circle: 'cir', cir: 'cir',
  place: 'pl', pl: 'pl',
  terrace: 'ter', ter: 'ter',
  trail: 'trl', trl: 'trl',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw',
  southeast: 'se', southwest: 'sw',
};

const tokenizeStreet = (s: string | null | undefined): string[] =>
  norm(s)
    .split(' ')
    .filter(Boolean)
    .map((t) => STREET_TOKEN_ALIASES[t] ?? t);

const extractStreetParts = (full: string | null | undefined): { houseNumber: string | null; road: string } => {
  const t = norm(full);
  const m = t.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (m) return { houseNumber: m[1], road: m[2] };
  return { houseNumber: null, road: t };
};

const jaccard = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  setA.forEach((tok) => { if (setB.has(tok)) inter += 1; });
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
};

const resultCity = (addr: NominatimAddress | undefined): string | null => {
  if (!addr) return null;
  return addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.municipality ?? addr.suburb ?? null;
};

const resultStateIsNevada = (addr: NominatimAddress | undefined): boolean => {
  if (!addr) return false;
  if (addr.state && norm(addr.state) === 'nevada') return true;
  if (addr['ISO3166-2-lvl4'] === 'US-NV') return true;
  return false;
};

// Class/type acceptance for a street-level rooftop-style match.
const STREET_ALLOWED_CLASSES = new Set([
  'building', 'amenity', 'shop', 'office', 'tourism',
  'healthcare', 'leisure', 'craft', 'historic', 'man_made',
]);
const STREET_ALLOWED_TYPES = new Set(['house', 'building', 'premise', 'yes']);

const isStreetLevelClass = (cls?: string, type?: string): boolean => {
  const c = (cls ?? '').toLowerCase();
  const t = (type ?? '').toLowerCase();
  if (STREET_ALLOWED_CLASSES.has(c)) return true;
  if (STREET_ALLOWED_TYPES.has(t)) return true;
  if (c === 'place' && (t === 'house' || t === 'farm' || t === 'isolated_dwelling')) return true;
  return false;
};

// Class/type acceptance for the fallback (city/county) strategy.
const FALLBACK_ALLOWED_PLACE_TYPES = new Set([
  'city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'locality',
]);

const isPlaceLevelClass = (cls?: string, type?: string): boolean => {
  const c = (cls ?? '').toLowerCase();
  const t = (type ?? '').toLowerCase();
  if (c === 'place' && FALLBACK_ALLOWED_PLACE_TYPES.has(t)) return true;
  if (c === 'boundary' && t === 'administrative') return true;
  return false;
};

interface ValidationResult {
  ok: boolean;
  reason?: string;
  score: number;
}

/**
 * Validate a Nominatim candidate against the input record for a
 * street-level (address_full) lookup. Returns a score so the caller can
 * pick the best valid candidate from `limit=5`.
 *
 * Hard rejects (return ok=false):
 *  - State is not Nevada.
 *  - Class/type is not a building/premise/amenity-style match.
 *  - Input ZIP provided AND result postcode differs (first 5 digits).
 *  - Input house number provided AND result house_number exists AND differs.
 *  - Both city and county mismatch the input.
 *  - Road token similarity is too low AND no other strong signal exists.
 */
const validateStreetCandidate = (
  r: GeocodeCandidate,
  hit: NominatimResult,
): ValidationResult => {
  const addr = hit.address;

  if (!resultStateIsNevada(addr)) {
    return { ok: false, reason: 'state ≠ Nevada', score: 0 };
  }

  if (!isStreetLevelClass(hit.class, hit.type)) {
    return { ok: false, reason: `class/type not address-level (${hit.class}/${hit.type})`, score: 0 };
  }

  const inputZip = (r.zip ?? '').replace(/\D/g, '').slice(0, 5);
  const resZip = (addr?.postcode ?? '').replace(/\D/g, '').slice(0, 5);
  if (inputZip && resZip && inputZip !== resZip) {
    return { ok: false, reason: `ZIP mismatch (${inputZip} vs ${resZip})`, score: 0 };
  }

  const street = extractStreetParts(r.street_address);
  const resHouse = norm(addr?.house_number);
  if (street.houseNumber && resHouse && street.houseNumber !== resHouse) {
    return { ok: false, reason: `house number mismatch (${street.houseNumber} vs ${resHouse})`, score: 0 };
  }

  const inputCity = norm(r.city);
  const resCityRaw = resultCity(addr);
  const resCity = norm(resCityRaw);
  const cityMatch = !!inputCity && !!resCity && (inputCity === resCity || inputCity.includes(resCity) || resCity.includes(inputCity));

  const inputCounty = norm(r.county).replace(/\s+county$/, '');
  const resCounty = norm(addr?.county).replace(/\s+county$/, '');
  const countyMatch = !!inputCounty && !!resCounty && inputCounty === resCounty;

  if (inputCity && resCity && !cityMatch && !countyMatch) {
    return { ok: false, reason: `city & county mismatch (${inputCity}/${inputCounty} vs ${resCity}/${resCounty})`, score: 0 };
  }

  const roadTokens = tokenizeStreet(street.road);
  const resRoadTokens = tokenizeStreet(addr?.road);
  const roadJaccard = jaccard(roadTokens, resRoadTokens);

  const houseExactMatch = !!street.houseNumber && street.houseNumber === resHouse;

  // Severe road mismatch: if neither the house number nor the road tokens
  // line up, treat as wrong building even when city/zip happen to match.
  if (!houseExactMatch && roadTokens.length > 0 && resRoadTokens.length > 0 && roadJaccard < 0.34) {
    return { ok: false, reason: `street name mismatch (jaccard=${roadJaccard.toFixed(2)})`, score: 0 };
  }

  // If the input has a house number but the result has none and the road
  // tokens don't overlap, we cannot verify it's the right building.
  if (street.houseNumber && !resHouse && roadTokens.length > 0 && roadJaccard < 0.5) {
    return { ok: false, reason: 'no house number on result and weak road match', score: 0 };
  }

  let score = 0;
  score += 3; // state NV (passed)
  if (cityMatch) score += 2;
  if (countyMatch) score += 1;
  if (inputZip && resZip && inputZip === resZip) score += 2;
  if (houseExactMatch) score += 4;
  if (roadJaccard >= 0.5) score += 2;
  else if (roadJaccard >= 0.34) score += 1;
  if (STREET_ALLOWED_CLASSES.has((hit.class ?? '').toLowerCase())) score += 2;
  if ((hit.type ?? '').toLowerCase() === 'house' || (hit.type ?? '').toLowerCase() === 'building') score += 1;
  score += Math.min(hit.importance ?? 0, 1);

  return { ok: true, score };
};

/**
 * Validate a Nominatim candidate for the city/county fallback strategy.
 * Different acceptance: place/admin types are intentionally expected.
 */
const validateFallbackCandidate = (
  r: GeocodeCandidate,
  hit: NominatimResult,
): ValidationResult => {
  const addr = hit.address;

  if (!resultStateIsNevada(addr)) {
    return { ok: false, reason: 'state ≠ Nevada', score: 0 };
  }

  if (!isPlaceLevelClass(hit.class, hit.type) && !isStreetLevelClass(hit.class, hit.type)) {
    return { ok: false, reason: `class/type not place-level (${hit.class}/${hit.type})`, score: 0 };
  }

  const inputCity = norm(r.city);
  const resCity = norm(resultCity(addr) ?? hit.display_name?.split(',')[0]);
  const inputCounty = norm(r.county).replace(/\s+county$/, '');
  const resCounty = norm(addr?.county).replace(/\s+county$/, '');

  const cityMatch = !!inputCity && !!resCity && (inputCity === resCity || resCity.includes(inputCity) || inputCity.includes(resCity));
  const countyMatch = !!inputCounty && !!resCounty && inputCounty === resCounty;

  if (!cityMatch && !countyMatch) {
    return { ok: false, reason: `neither city nor county match (${inputCity}/${inputCounty} vs ${resCity}/${resCounty})`, score: 0 };
  }

  let score = 1;
  if (cityMatch) score += 2;
  if (countyMatch) score += 2;
  score += Math.min(hit.importance ?? 0, 1);
  return { ok: true, score };
};

const pickBestCandidate = (
  hits: NominatimResult[],
  validate: (h: NominatimResult) => ValidationResult,
): { hit: NominatimResult; validation: ValidationResult } | null => {
  let best: { hit: NominatimResult; validation: ValidationResult } | null = null;
  for (const hit of hits) {
    const v = validate(hit);
    if (!v.ok) continue;
    if (!best || v.score > best.validation.score) {
      best = { hit, validation: v };
    }
  }
  return best;
};

/**
 * Build the access_notes value with a geocode tag appended.
 * Replaces any prior `[geocode:...]` tag and places the new tag on its
 * own line so it never visually collides with human-written notes.
 *
 * Public confidence values written into the tag are strictly 'high' | 'low'.
 */
export const stampGeocodeTag = (
  notes: string | null | undefined,
  strategy: GeocodeStrategy,
  confidence: 'high' | 'low',
): string => {
  const base = (notes ?? '')
    .replace(/\[geocode:[^\]]+\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  const tag = `${GEOCODE_TAG_PREFIX}${strategy}|${confidence}|${new Date().toISOString().slice(0, 10)}]`;
  return base.length > 0 ? `${base}\n${tag}` : tag;
};

/** Parse a stored geocode tag back, if present. */
export const parseGeocodeTag = (
  notes: string | null | undefined,
): { strategy: GeocodeStrategy; confidence: 'high' | 'low'; date: string } | null => {
  if (!notes) return null;
  const m = notes.match(/\[geocode:([^|]+)\|([^|]+)\|([^\]]+)\]/i);
  if (!m) return null;
  const conf = m[2].toLowerCase();
  const normalizedConf: 'high' | 'low' = conf === 'low' ? 'low' : 'high';
  return {
    strategy: m[1] as GeocodeStrategy,
    confidence: normalizedConf,
    date: m[3],
  };
};

export const isGeocodeFailed = (notes: string | null | undefined): boolean =>
  !!notes && /\[geocode:failed\]/i.test(notes);

const fetchCensusGeocode = async (
  r: GeocodeCandidate,
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const q = [r.street_address, r.city, r.state, r.zip]
      .filter((p) => p && String(p).trim() !== '')
      .join(', ');
    if (!q) return null;
    const url = `${CENSUS_GEOCODER_URL}?address=${encodeURIComponent(q)}&benchmark=2020&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    const lat = match.coordinates?.y;
    const lng = match.coordinates?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Nevada bounding box check — reject if outside Nevada
    if (lat < 35.0019 || lat > 42.0022 || lng < -120.0064 || lng > -114.0396) return null;
    return { lat, lng };
  } catch {
    return null;
  }
};

/**
 * Geocode a single record. Caller is responsible for persistence.
 * Returns the outcome (does NOT call the DB).
 *
 * Validation flow:
 *  - Request limit=5, addressdetails=1, Nevada viewbox + bounded=1.
 *  - Score every returned candidate against the source record.
 *  - Pick the best valid candidate; if none pass validation → failed.
 */
export const geocodeOne = async (r: GeocodeCandidate): Promise<GeocodeOutcome> => {
  if (r.mappable === false) {
    return { id: r.id, status: 'skipped', reason: 'list-only (mappable=false)' };
  }
  if (r.latitude != null && r.longitude != null) {
    return { id: r.id, status: 'skipped', reason: 'already has coordinates' };
  }

  // Strategy 1 — full address, validated.
  const addrQ = buildAddressQuery(r);
  if (addrQ) {
    const hits = await fetchNominatim(addrQ, { limit: 5, bounded: true });
    const best = pickBestCandidate(hits, (h) => validateStreetCandidate(r, h));
    if (best) {
      const lat = parseFloat(best.hit.lat);
      const lng = parseFloat(best.hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          id: r.id,
          status: 'geocoded',
          strategy: 'address_full',
          confidence: 'high',
          latitude: lat,
          longitude: lng,
        };
      }
    }
  }

  // Strategy 2 — city + county + state fallback, validated.
  const fbQ = buildFallbackQuery(r);
  if (fbQ) {
    const hits = await fetchNominatim(fbQ, { limit: 5, bounded: true });
    const best = pickBestCandidate(hits, (h) => validateFallbackCandidate(r, h));
    if (best) {
      const lat = parseFloat(best.hit.lat);
      const lng = parseFloat(best.hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          id: r.id,
          status: 'geocoded',
          strategy: 'city_county_fallback',
          confidence: 'low',
          latitude: lat,
          longitude: lng,
        };
      }
    }
  }

  // Strategy 3 — Census Geocoder fallback for rural/highway/tribal addresses.
  const censusResult = await fetchCensusGeocode(r);
  if (censusResult) {
    return {
      id: r.id,
      status: 'geocoded',
      strategy: 'census_onelineaddress',
      confidence: 'low',
      latitude: censusResult.lat,
      longitude: censusResult.lng,
    };
  }

  return { id: r.id, status: 'failed', reason: 'no validated geocoder match' };
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
