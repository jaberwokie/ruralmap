/**
 * Phase 2B.3 — PRIVATE member-address geocoder adapter boundary.
 *
 * PURPOSE
 * This module makes the member resolver production-ready for a single
 * NovumHealth-approved, BAA-covered private geocoding endpoint, WITHOUT
 * hard-coding any vendor and without weakening the existing privacy boundary.
 *
 * HARD RULES
 *  - Server-side only. Nothing here is importable by browser code, and no
 *    credential or endpoint value is ever returned to a caller.
 *  - Activates ONLY when `MEMBER_GEOCODER_APPROVED === 'true'` AND every
 *    required config value is present. Otherwise the resolver keeps its
 *    existing fail-closed `member_geocoder_not_configured` behavior.
 *  - Public/consumer geocoders are explicitly NOT acceptable here: Google Maps
 *    Platform, US Census, public Nominatim, Mapbox, HERE. A configured
 *    endpoint pointing at one of those hosts is REFUSED at config time.
 *  - Only the normalized address string is transmitted. No member name, member
 *    ID, insurance, diagnosis, program, session, or request identity.
 *  - No raw address in logs or errors — this module never logs the address and
 *    never includes it in a thrown/returned message.
 */
import type { ExternalHit, GeocoderPort } from './resolver.ts';

/** Config contract, all server-side secrets. */
export interface MemberGeocoderEnv {
  MEMBER_GEOCODER_APPROVED?: string;
  MEMBER_GEOCODER_PROVIDER?: string;
  MEMBER_GEOCODER_ENDPOINT?: string;
  MEMBER_GEOCODER_API_KEY?: string;
  /** Header carrying the credential. Default: `Authorization`. */
  MEMBER_GEOCODER_AUTH_HEADER?: string;
  /** Scheme prefix for the credential. Default: `Bearer`. Use `''` for raw. */
  MEMBER_GEOCODER_AUTH_SCHEME?: string;
  /** Request timeout, clamped to 1000–10000 ms. Default: 4000. */
  MEMBER_GEOCODER_TIMEOUT_MS?: string;
}

export interface MemberGeocoderConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  authHeader: string;
  authScheme: string;
  timeoutMs: number;
}

export type MemberGeocoderConfigStatus =
  | { enabled: true; config: MemberGeocoderConfig }
  | { enabled: false; reason: MemberGeocoderDisabledReason };

export type MemberGeocoderDisabledReason =
  | 'not_approved'
  | 'incomplete_config'
  | 'insecure_endpoint'
  | 'disallowed_public_provider';

/**
 * Hosts that must never receive a member address, regardless of configuration.
 * Kept as host substrings so a configured endpoint cannot smuggle one in.
 */
const DISALLOWED_HOSTS = [
  'googleapis.com',
  'google.com',
  'geo.census.gov',
  'census.gov',
  'openstreetmap.org',
  'nominatim',
  'mapbox.com',
  'hereapi.com',
  'here.com',
  'geocod.io',
  'smartystreets.com',
  'locationiq.com',
  'opencagedata.com',
];

const clampTimeout = (raw: string | undefined): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 4000;
  return Math.min(10000, Math.max(1000, Math.trunc(n)));
};

/**
 * Read the private-provider configuration. Fails closed on every ambiguity.
 * The returned value carries no diagnostic text derived from the config.
 */
export const readMemberGeocoderConfig = (
  env: MemberGeocoderEnv,
): MemberGeocoderConfigStatus => {
  // Explicit approval gate. Anything other than the exact string is disabled.
  if (env.MEMBER_GEOCODER_APPROVED !== 'true') {
    return { enabled: false, reason: 'not_approved' };
  }

  const provider = (env.MEMBER_GEOCODER_PROVIDER ?? '').trim();
  const endpoint = (env.MEMBER_GEOCODER_ENDPOINT ?? '').trim();
  const apiKey = (env.MEMBER_GEOCODER_API_KEY ?? '').trim();
  if (!provider || !endpoint || !apiKey) {
    return { enabled: false, reason: 'incomplete_config' };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { enabled: false, reason: 'insecure_endpoint' };
  }
  // A member address may only traverse TLS.
  if (url.protocol !== 'https:') {
    return { enabled: false, reason: 'insecure_endpoint' };
  }
  const host = url.hostname.toLowerCase();
  if (DISALLOWED_HOSTS.some((bad) => host === bad || host.includes(bad))) {
    return { enabled: false, reason: 'disallowed_public_provider' };
  }

  return {
    enabled: true,
    config: {
      provider,
      endpoint: url.toString(),
      apiKey,
      authHeader: (env.MEMBER_GEOCODER_AUTH_HEADER ?? 'Authorization').trim() || 'Authorization',
      authScheme: (env.MEMBER_GEOCODER_AUTH_SCHEME ?? 'Bearer').trim(),
      timeoutMs: clampTimeout(env.MEMBER_GEOCODER_TIMEOUT_MS),
    },
  };
};

/** Minimal accepted provider response. Anything richer is ignored. */
interface ProviderResponse {
  resolved?: unknown;
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  confidence?: unknown;
  precision?: unknown;
}

const num = (a: unknown, b: unknown): number | null => {
  const v = typeof a === 'number' ? a : typeof b === 'number' ? b : NaN;
  return Number.isFinite(v) ? (v as number) : null;
};

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 32) : fallback;

/**
 * Normalize and validate a provider payload. Returns null (fail closed) for
 * anything malformed, unresolved, or outside plausible earth coordinates.
 * Nevada bounds checking stays in the resolver, which owns that policy.
 */
export const normalizeProviderResponse = (payload: unknown): ExternalHit | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as ProviderResponse;
  if (p.resolved === false) return null;

  const lat = num(p.lat, p.latitude);
  const lng = num(p.lng, p.longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // 0,0 is the classic malformed-geocode sentinel, never a Nevada address.
  if (lat === 0 && lng === 0) return null;

  return {
    lat,
    lng,
    confidence: str(p.confidence, 'medium'),
    precision: str(p.precision, 'approximate'),
    county: null,
    postal_code: null,
    // A formatted address is deliberately DISCARDED: member address text is
    // never persisted or returned by this pipeline.
    label: null,
  };
};

export interface AdapterDeps {
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Build the resolver port for the approved private provider.
 *
 * Transport: HTTPS POST, JSON body `{ address }` only.
 */
export const createPrivateMemberGeocoder = (
  config: MemberGeocoderConfig,
  deps: AdapterDeps = {},
): GeocoderPort => {
  const doFetch = deps.fetchImpl ?? fetch;

  return {
    name: 'private_member_geocoder',
    failureCode: 'member_geocoder_failed',
    run: async (canonical: string): Promise<ExternalHit | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const credential = config.authScheme
          ? `${config.authScheme} ${config.apiKey}`
          : config.apiKey;

        const res = await doFetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            [config.authHeader]: credential,
          },
          // MINIMIZATION: the normalized address, and nothing else.
          body: JSON.stringify({ address: canonical }),
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        return normalizeProviderResponse(payload);
      } catch {
        // Timeout / transport / parse failure — fail closed. The address is
        // never included in any error path.
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
};
