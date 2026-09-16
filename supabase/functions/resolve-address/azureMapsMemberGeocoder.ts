/**
 * Phase 2B.4 — NATIVE Azure Maps member-address geocoder adapter.
 *
 * WHY A DEDICATED ADAPTER
 * The generic private adapter (`privateMemberGeocoder.ts`) speaks a simple
 * `{ address }` POST contract and deliberately REFUSES public consumer
 * geocoders. Azure Maps has its own request/response schema, so it gets its own
 * explicit, separately gated adapter instead of loosening those protections.
 *
 * HARD RULES
 *  - Server-side only. Never importable from browser code; the credential is
 *    never exposed to a client and never written to a VITE_* variable.
 *  - Activates ONLY when ALL of these hold:
 *      MEMBER_GEOCODER_APPROVED === 'true'
 *      MEMBER_GEOCODER_PROVIDER === 'azure_maps'
 *      an Azure Maps key is present server-side
 *      the resolved endpoint is a valid HTTPS Azure Maps host
 *    Otherwise the resolver keeps its fail-closed
 *    `member_geocoder_not_configured` behavior.
 *  - The member address travels in the HTTPS request BODY only — never in a
 *    URL, query string, or log line.
 *  - The credential travels in the `subscription-key` HEADER only — never in
 *    the URL and never in the body.
 *  - Transmitted data is exactly one geocoding item: the normalized address
 *    plus minimal search constraints. No member name, member ID, insurance,
 *    diagnosis, program, session, or request identity.
 *  - Nothing is logged: not the address, not the body, not the credential, not
 *    Azure's returned address text, not the endpoint.
 *  - Fail closed on non-2xx, malformed payload, no result, invalid or
 *    zero coordinates, ambiguity, or timeout.
 *  - Nevada bounds validation stays owned by `resolver.ts`.
 */
import type { ExternalHit, GeocoderPort } from './resolver.ts';

/** The exact provider token that selects this adapter. */
export const AZURE_MAPS_PROVIDER = 'azure_maps';

/** Default synchronous geocoding batch endpoint (address in the body). */
export const AZURE_MAPS_DEFAULT_ENDPOINT = 'https://atlas.microsoft.com/geocode:batch';
export const AZURE_MAPS_DEFAULT_API_VERSION = '2026-01-01';

const AZURE_ALLOWED_HOST_SUFFIXES = ['atlas.microsoft.com', 'atlas.azure.us'];

export interface AzureMapsEnv {
  MEMBER_GEOCODER_APPROVED?: string;
  MEMBER_GEOCODER_PROVIDER?: string;
  /** Preferred, dedicated credential name — unambiguous ownership. */
  AZURE_MAPS_SUBSCRIPTION_KEY?: string;
  /** Optional endpoint override (sovereign clouds / private link). */
  AZURE_MAPS_ENDPOINT?: string;
  AZURE_MAPS_API_VERSION?: string;
  /** Request timeout, clamped to 1000–10000 ms. Default 4000. */
  MEMBER_GEOCODER_TIMEOUT_MS?: string;
}

export interface AzureMapsConfig {
  /** Base endpoint WITHOUT the credential. api-version is a non-secret param. */
  endpoint: string;
  apiVersion: string;
  subscriptionKey: string;
  timeoutMs: number;
}

export type AzureMapsConfigStatus =
  | { enabled: true; config: AzureMapsConfig }
  | { enabled: false; reason: AzureMapsDisabledReason };

export type AzureMapsDisabledReason =
  | 'not_approved'
  | 'provider_not_selected'
  | 'missing_credential'
  | 'invalid_endpoint';

const clampTimeout = (raw: string | undefined): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 4000;
  return Math.min(10000, Math.max(1000, Math.trunc(n)));
};

/**
 * Read Azure Maps configuration. Fails closed on every ambiguity and returns
 * no diagnostic text derived from the credential.
 */
export const readAzureMapsConfig = (env: AzureMapsEnv): AzureMapsConfigStatus => {
  if (env.MEMBER_GEOCODER_APPROVED !== 'true') {
    return { enabled: false, reason: 'not_approved' };
  }
  if ((env.MEMBER_GEOCODER_PROVIDER ?? '').trim() !== AZURE_MAPS_PROVIDER) {
    return { enabled: false, reason: 'provider_not_selected' };
  }
  const subscriptionKey = (env.AZURE_MAPS_SUBSCRIPTION_KEY ?? '').trim();
  if (!subscriptionKey) return { enabled: false, reason: 'missing_credential' };

  const rawEndpoint = (env.AZURE_MAPS_ENDPOINT ?? '').trim() || AZURE_MAPS_DEFAULT_ENDPOINT;
  let url: URL;
  try {
    url = new URL(rawEndpoint);
  } catch {
    return { enabled: false, reason: 'invalid_endpoint' };
  }
  if (url.protocol !== 'https:') return { enabled: false, reason: 'invalid_endpoint' };
  const host = url.hostname.toLowerCase();
  if (!AZURE_ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { enabled: false, reason: 'invalid_endpoint' };
  }
  // A credential must never be smuggled into the endpoint's query string.
  if (url.search) return { enabled: false, reason: 'invalid_endpoint' };

  const apiVersion = (env.AZURE_MAPS_API_VERSION ?? '').trim() || AZURE_MAPS_DEFAULT_API_VERSION;
  if (!/^\d{4}-\d{2}-\d{2}(-preview)?$/.test(apiVersion)) {
    return { enabled: false, reason: 'invalid_endpoint' };
  }

  return {
    enabled: true,
    config: {
      endpoint: `${url.origin}${url.pathname}`,
      apiVersion,
      subscriptionKey,
      timeoutMs: clampTimeout(env.MEMBER_GEOCODER_TIMEOUT_MS),
    },
  };
};

/**
 * Build the single-item batch body. Exactly one geocoding item, carrying the
 * normalized address and the minimum search constraints. Nothing else.
 */
export const buildAzureBatchBody = (canonical: string): {
  batchItems: { query: string; top: number; countryRegion: string }[];
} => ({
  batchItems: [{ query: canonical, top: 1, countryRegion: 'US' }],
});

/**
 * Azure result classes that are address/house-number level. Anything coarser is
 * locality/postal precision and must NOT be presented as a precise pin.
 */
const ADDRESS_LEVEL_TYPES = new Set(['address', 'pointaddress', 'housenumber']);
/** Result classes too coarse to place a member at all. */
const REJECTED_TYPES = new Set(['country', 'countryregion', 'adminarea', 'adminarea1', 'state', 'region']);

const lower = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * Parse the minimum coordinate/quality fields from an Azure geocode:batch
 * response. Returns null (fail closed) for anything malformed, empty,
 * ambiguous, or coarser than a placeable locality.
 *
 * Azure's returned formatted address text is DISCARDED — member address text is
 * never persisted or returned by this pipeline.
 */
export const parseAzureBatchResponse = (payload: unknown): ExternalHit | null => {
  if (!payload || typeof payload !== 'object') return null;
  const items = (payload as { batchItems?: unknown }).batchItems;
  if (!Array.isArray(items) || items.length !== 1) return null;

  const item = items[0];
  if (!item || typeof item !== 'object') return null;
  // A per-item error object is a failure, not a result.
  if ((item as { error?: unknown }).error) return null;

  const features = (item as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const feature = features[0];
  if (!feature || typeof feature !== 'object') return null;

  const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
  const coords = geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  // Azure/GeoJSON order is [longitude, latitude].
  const lng = coords[0];
  const lat = coords[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // 0,0 is the classic malformed-geocode sentinel, never a Nevada address.
  if (lat === 0 && lng === 0) return null;

  const props = (feature as { properties?: Record<string, unknown> }).properties ?? {};
  const type = lower(props.type);
  if (REJECTED_TYPES.has(type)) return null;

  const confidenceRaw = lower(props.confidence);
  const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
    ? confidenceRaw
    : 'medium';
  if (confidence === 'low') return null; // ambiguous — wrong pin is worse than no pin.

  const matchCodes = Array.isArray(props.matchCodes) ? props.matchCodes.map(lower) : [];
  // An explicitly ambiguous match is refused.
  if (matchCodes.includes('ambiguous')) return null;

  const address = (props.address ?? {}) as Record<string, unknown>;
  const hasHouseNumber = typeof address.addressLine === 'string'
    ? /\d/.test(address.addressLine)
    : typeof address.streetNumber === 'string' && address.streetNumber.trim() !== '';

  // Precision is reported HONESTLY. `rooftop` requires an address-level class
  // with a house number; anything else stays `approximate`, which the resolver
  // surfaces through its existing is_approximate semantics.
  const precision = ADDRESS_LEVEL_TYPES.has(type) && hasHouseNumber ? 'rooftop' : 'approximate';

  const postal = typeof address.postalCode === 'string' ? address.postalCode.trim().slice(0, 10) : null;

  return {
    lat,
    lng,
    confidence,
    precision,
    // County/label text from Azure is intentionally not trusted or retained;
    // the resolver derives county from its own Nevada mapping.
    county: null,
    postal_code: postal || null,
    label: null,
  };
};

export interface AzureAdapterDeps {
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Build the resolver port for Azure Maps.
 *
 * Transport: HTTPS POST, address in the body, credential in the
 * `subscription-key` header, `api-version` as the only query parameter.
 */
export const createAzureMapsMemberGeocoder = (
  config: AzureMapsConfig,
  deps: AzureAdapterDeps = {},
): GeocoderPort => {
  const doFetch = deps.fetchImpl ?? fetch;
  const url = `${config.endpoint}?api-version=${encodeURIComponent(config.apiVersion)}`;

  return {
    // Provenance recorded in the internal cache is the approved-private-member
    // pathway. It carries no address text and no credential.
    name: 'private_member_geocoder',
    failureCode: 'member_geocoder_failed',
    run: async (canonical: string): Promise<ExternalHit | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const res = await doFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            // Credential is header-only.
            'subscription-key': config.subscriptionKey,
          },
          body: JSON.stringify(buildAzureBatchBody(canonical)),
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        return parseAzureBatchResponse(payload);
      } catch {
        // Timeout / transport / parse failure — fail closed. The address is
        // never included in any error or log path.
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
};
