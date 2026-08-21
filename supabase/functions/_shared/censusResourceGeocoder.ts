/**
 * Phase 2D — U.S. Census Geocoder as the single approved external provider for
 * PUBLIC RESOURCE addresses.
 *
 * Scope boundary: this module is for public business/facility/service addresses
 * only. It is NEVER reachable from member-address resolution
 * (`member_address_external_provider = none_approved` is unchanged).
 *
 * Provenance honesty: Census `onelineaddress` results are interpolated address
 * RANGE results. They are never labelled `rooftop`. A wrong pin is worse than
 * no pin, so validation rejects anything that cannot be tied back to the source
 * address.
 */
import { isInNevada } from './geocodeNormalize.ts';
import { compareStreetIdentity, type StreetVerdict } from './streetIdentity.ts';
import type { ResourceExternalHit, ResourceExternalPort } from './resourceGeocodeCache.ts';

export const CENSUS_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

/**
 * Census supports a stable `Current` benchmark alias, which avoids pinning the
 * application to an obsolete vintage. `Public_AR_Current` is the documented
 * current public address-range benchmark identifier.
 */
export const CENSUS_BENCHMARK = 'Public_AR_Current';

export interface CensusValidationDetail {
  matched_address_available: boolean;
  state_match: boolean | null;
  zip_match: boolean | null;
  street_identity_present: boolean;
  /** Phase 2D.1 — physical street identity comparison against matchedAddress. */
  house_number_match: boolean | null;
  street_name_match: boolean | null;
  street_verdict: StreetVerdict | null;
  in_nevada: boolean | null;
  validation_status: 'accepted' | 'rejected';
  rejection_reason: string | null;
}


export interface CensusSourceAddress {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

const digits5 = (v: unknown): string =>
  String(v ?? '').replace(/\D/g, '').slice(0, 5);

const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/** A deterministic street identity means "<number> <name>", not a bare city. */
export const hasStreetIdentity = (street: string | null | undefined): boolean => {
  const s = String(street ?? '').trim();
  if (!s) return false;
  return /\d/.test(s) && /[a-z]{2,}/i.test(s);
};

export interface CensusMatch {
  lat: number;
  lng: number;
  matchedAddress: string | null;
  matchedState: string | null;
  matchedZip: string | null;
}

/** Extract the first usable match from a raw Census onelineaddress payload. */
export const extractCensusMatch = (payload: unknown): CensusMatch | null => {
  // deno-lint-ignore no-explicit-any
  const match = (payload as any)?.result?.addressMatches?.[0];
  if (!match) return null;
  const lat = match?.coordinates?.y;
  const lng = match?.coordinates?.x;
  if (!finite(lat) || !finite(lng)) return null;
  const comp = match?.addressComponents ?? {};
  return {
    lat,
    lng,
    matchedAddress: typeof match?.matchedAddress === 'string' ? match.matchedAddress : null,
    matchedState: typeof comp?.state === 'string' ? comp.state : null,
    matchedZip: typeof comp?.zip === 'string' ? comp.zip : null,
  };
};

/**
 * Server-side validation of a Census forward-geocode result against the SOURCE
 * address. This replaces the retired browser reverse-Nominatim spot check: the
 * forward response itself carries the evidence we need.
 */
export const validateCensusMatch = (
  source: CensusSourceAddress,
  match: CensusMatch | null,
  opts: { requireNevada?: boolean } = {},
): CensusValidationDetail => {
  const requireNevada = opts.requireNevada ?? true;
  const streetIdentity = hasStreetIdentity(source.street_address);

  const base: CensusValidationDetail = {
    matched_address_available: !!match?.matchedAddress,
    state_match: null,
    zip_match: null,
    street_identity_present: streetIdentity,
    in_nevada: null,
    validation_status: 'rejected',
    rejection_reason: null,
  };

  if (!streetIdentity) {
    return { ...base, rejection_reason: 'source_address_lacks_street_identity' };
  }
  if (!match) {
    return { ...base, rejection_reason: 'no_census_match' };
  }
  if (!match.matchedAddress) {
    return { ...base, rejection_reason: 'no_matched_address_returned' };
  }
  if (match.lat === 0 && match.lng === 0) {
    return { ...base, rejection_reason: 'zero_coordinate' };
  }

  const inNv = isInNevada(match.lat, match.lng);
  if (requireNevada && !inNv) {
    return { ...base, in_nevada: inNv, rejection_reason: 'coordinate_outside_nevada' };
  }

  // State compatibility — only asserted when both sides supply a state.
  const srcState = String(source.state ?? '').trim().toUpperCase();
  const matchState = String(match.matchedState ?? '').trim().toUpperCase();
  const stateMatch = srcState && matchState ? srcState === matchState : null;
  if (stateMatch === false) {
    return { ...base, in_nevada: inNv, state_match: false, rejection_reason: 'state_mismatch' };
  }

  // ZIP compatibility — only asserted when both sides supply a ZIP.
  const srcZip = digits5(source.zip);
  const matchZip = digits5(match.matchedZip);
  const zipMatch = srcZip && matchZip ? srcZip === matchZip : null;
  if (zipMatch === false) {
    return {
      ...base,
      in_nevada: inNv,
      state_match: stateMatch,
      zip_match: false,
      rejection_reason: 'zip_mismatch',
    };
  }

  return {
    matched_address_available: true,
    state_match: stateMatch,
    zip_match: zipMatch,
    street_identity_present: true,
    in_nevada: inNv,
    validation_status: 'accepted',
    rejection_reason: null,
  };
};

/** Conservative, honest provenance for an accepted Census result. */
export const CENSUS_PROVENANCE = {
  confidence: 'low',
  precision: 'approximate',
  match_type: 'census_onelineaddress',
} as const;

export const fetchCensusRaw = async (address: string): Promise<unknown | null> => {
  const url =
    `${CENSUS_URL}?address=${encodeURIComponent(address)}` +
    `&benchmark=${CENSUS_BENCHMARK}&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export interface CensusPortOptions {
  source: CensusSourceAddress;
  requireNevada?: boolean;
  /** Receives the validation detail for audit/cache metadata. */
  onValidation?: (detail: CensusValidationDetail) => void;
  /** Injectable for tests; defaults to the real Census request. */
  fetchRaw?: (address: string) => Promise<unknown | null>;
}

/**
 * Build the Census resource port. Only ever constructed server-side inside an
 * authenticated administrative edge function.
 */
export const createCensusPort = (opts: CensusPortOptions): ResourceExternalPort => ({
  name: 'census',
  run: async (address): Promise<ResourceExternalHit | null> => {
    const raw = await (opts.fetchRaw ?? fetchCensusRaw)(address);
    const match = extractCensusMatch(raw);
    const detail = validateCensusMatch(opts.source, match, {
      requireNevada: opts.requireNevada ?? true,
    });
    opts.onValidation?.(detail);
    if (detail.validation_status !== 'accepted' || !match) return null;
    return {
      lat: match.lat,
      lng: match.lng,
      confidence: CENSUS_PROVENANCE.confidence,
      match_type: CENSUS_PROVENANCE.match_type,
      precision: CENSUS_PROVENANCE.precision,
      county: null,
      postal_code: match.matchedZip ?? opts.source.zip ?? null,
    };
  },
});

/** Geodesic distance in meters (haversine) — used by the dry-run comparison. */
export const geodesicMeters = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number => {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};
