/**
 * Phase 2E — INTERNAL Nevada TIGER/Line street-range member geocoder.
 *
 * Purpose: resolve a member address to coordinates WITHOUT disclosing it to any
 * third party, and WITHOUT persisting it anywhere.
 *
 * How it works:
 *   - `public.tiger_street_ranges` holds PUBLIC U.S. Census TIGER/Line ADDRFEAT
 *     reference data for Nevada only (street identity, left/right house-number
 *     ranges, parity, ZIP, county, line geometry). It contains no member data.
 *   - The submitted address is parsed in memory, matched against that reference
 *     data through a service-role RPC, and a point is interpolated along the
 *     matched segment from the house number's position inside the range.
 *   - Nothing about the request is written or logged: no raw address, no
 *     canonical address, no HMAC key, no house number, no coordinates.
 *
 * Precision honesty: TIGER address-range interpolation is NOT rooftop
 * precision. Results are reported as `street_range_interpolated` and are always
 * flagged approximate. City/ZIP-only input is NOT pinned to a centroid — it
 * fails closed into manual placement, because a wrong pin is worse than no pin.
 *
 * Compliance framing: these are technical safeguards (no third-party
 * disclosure, no member-address persistence, no PHI in logs). They do not by
 * themselves make the deployment HIPAA compliant — that depends on the hosting
 * agreement/BAA and organizational controls.
 */
import { parseMemberAddress, type ParsedMemberAddress } from '../_shared/tigerStreetKey.ts';
import { NEVADA_COUNTY_FIPS, type GeocodeFailureCode } from '../_shared/geocodeNormalize.ts';

/** FIPS → canonical Nevada county name (public geography, not member data). */
const COUNTY_BY_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(NEVADA_COUNTY_FIPS).map(([name, fips]) => [
    fips,
    name.replace(/\b\w/g, (c) => c.toUpperCase()),
  ]),
);
import type { ExternalHit, GeocoderPort } from './resolver.ts';

export interface TigerCandidate {
  street_key: string;
  street_core: string;
  fullname: string;
  county_fips: string;
  tlid: string;
  side: string;
  zip: string | null;
  from_hn: number;
  to_hn: number;
  parity: string | null;
  exact_key: boolean;
  zip_match: boolean;
  lat: number;
  lng: number;
}

export interface TigerPorts {
  /** Reference-data candidate lookup (public TIGER data only). */
  matchAddress: (args: {
    house: number;
    streetKey: string;
    streetCore: string;
    zip: string | null;
  }) => Promise<TigerCandidate[]>;
  /** Distinguishes "unknown street" from "house number out of range". */
  streetExists?: (args: {
    streetKey: string;
    streetCore: string;
    zip: string | null;
  }) => Promise<boolean>;
}

export type TigerRejectReason =
  | 'not_a_street_address'
  | 'out_of_state'
  | 'unknown_street'
  | 'house_number_out_of_range'
  | 'ambiguous'
  | 'reference_data_unavailable';

export type TigerOutcome =
  | {
      resolved: true;
      lat: number;
      lng: number;
      precision: 'street_range_interpolated';
      confidence: 'medium';
      county_fips: string;
      zip: string | null;
    }
  | { resolved: false; reason: TigerRejectReason };

export const TIGER_FAILURE_CODES: Record<TigerRejectReason, GeocodeFailureCode> = {
  not_a_street_address: 'tiger_not_a_street_address',
  out_of_state: 'tiger_out_of_state',
  unknown_street: 'tiger_no_match',
  house_number_out_of_range: 'tiger_out_of_range',
  ambiguous: 'tiger_ambiguous',
  reference_data_unavailable: 'tiger_unavailable',
};

/** Other U.S. state tokens. Their presence means the address is not Nevada. */
const OTHER_STATE_TOKENS = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il',
  'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt',
  'ne', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
  'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
  'california', 'arizona', 'utah', 'idaho', 'oregon',
]);

const hasOtherState = (address: string): boolean =>
  String(address ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .some((t) => OTHER_STATE_TOKENS.has(t));

/** Rough great-circle miles; used only for the ambiguity spread check. */
const milesBetween = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/**
 * Candidates are only accepted when they describe ONE place. Segments of the
 * same block from both sides of the street, or adjacent TIGER edges, cluster
 * tightly; two same-named streets in different towns do not.
 */
const AMBIGUITY_SPREAD_MI = 0.5;

const isUsableCandidate = (c: TigerCandidate): boolean =>
  Number.isFinite(c?.lat) && Number.isFinite(c?.lng);

export const decideTigerMatch = (
  parsed: ParsedMemberAddress,
  candidates: TigerCandidate[],
): TigerOutcome => {
  const usable = (candidates ?? []).filter(isUsableCandidate);
  if (usable.length === 0) return { resolved: false, reason: 'unknown_street' };

  // Narrow deterministically: ZIP first, then exact street identity.
  const zipPool = parsed.zip ? usable.filter((c) => c.zip_match) : [];
  let pool = zipPool.length > 0 ? zipPool : usable;
  const exact = pool.filter((c) => c.exact_key);
  if (exact.length > 0) pool = exact;

  const first = pool[0];
  const spread = pool.reduce(
    (max, c) => Math.max(max, milesBetween(first.lat, first.lng, c.lat, c.lng)),
    0,
  );
  if (spread > AMBIGUITY_SPREAD_MI) return { resolved: false, reason: 'ambiguous' };

  return {
    resolved: true,
    lat: first.lat,
    lng: first.lng,
    precision: 'street_range_interpolated',
    confidence: 'medium',
    county_fips: first.county_fips,
    zip: first.zip ?? parsed.zip,
  };
};

/**
 * Resolve one address against the internal Nevada reference data.
 * No network egress. No writes. No logging of address content.
 */
export const geocodeMemberAddressLocally = async (
  ports: TigerPorts,
  address: string,
): Promise<TigerOutcome> => {
  const parsed = parseMemberAddress(address);

  if (hasOtherState(address)) return { resolved: false, reason: 'out_of_state' };
  // City/ZIP-only, PO boxes, lettered house numbers: never centroid-pinned.
  if (!parsed.isStreetAddress || parsed.houseNumber === null) {
    return { resolved: false, reason: 'not_a_street_address' };
  }

  let candidates: TigerCandidate[];
  try {
    candidates = await ports.matchAddress({
      house: parsed.houseNumber,
      streetKey: parsed.streetKey,
      streetCore: parsed.streetCore,
      zip: parsed.zip,
    });
  } catch {
    return { resolved: false, reason: 'reference_data_unavailable' };
  }

  if (!candidates || candidates.length === 0) {
    // The street may be known while the house number sits outside every range.
    if (ports.streetExists) {
      try {
        const exists = await ports.streetExists({
          streetKey: parsed.streetKey,
          streetCore: parsed.streetCore,
          zip: parsed.zip,
        });
        if (exists) return { resolved: false, reason: 'house_number_out_of_range' };
      } catch {
        return { resolved: false, reason: 'reference_data_unavailable' };
      }
    }
    return { resolved: false, reason: 'unknown_street' };
  }

  return decideTigerMatch(parsed, candidates);
};

/**
 * Resolver adapter. `name: 'internal_tiger'` is provenance for the response
 * only — an automatic member lookup writes no row at all.
 */
export const createTigerMemberGeocoder = (ports: TigerPorts): GeocoderPort => {
  let lastFailure: GeocodeFailureCode | null = null;
  return {
    name: 'internal_tiger',
    failureCode: 'tiger_no_match',
    resolveFailureCode: () => lastFailure,
    run: async (_canonical: string, original: string): Promise<ExternalHit | null> => {
      const outcome = await geocodeMemberAddressLocally(ports, original);
      if (!outcome.resolved) {
        lastFailure = TIGER_FAILURE_CODES[outcome.reason];
        return null;
      }
      lastFailure = null;
      return {
        lat: outcome.lat,
        lng: outcome.lng,
        confidence: outcome.confidence,
        precision: outcome.precision,
        postal_code: outcome.zip,
        // No formatted/display address is ever produced for a member address.
        label: null,
      };
    },
  };
};
